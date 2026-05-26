const autoStore = require('../utils/autoStore');
const { getTokenInfo } = require('./pumpfun');
const { getBalance, getTokenBalance, signAndSendTransaction, getPublicKey } = require('./userWallet');
const { getBuyTransaction, getSellTransaction } = require('./pumpfun');
const { collectFee, calculateFee } = require('./fee');
const logger = require('../utils/logger');

const CHECK_INTERVAL_MS = 20_000; // check every 20 seconds
let botRef = null;

function startAutomation(bot) {
  botRef = bot;
  setInterval(runAllStrategies, CHECK_INTERVAL_MS);
  logger.info('🤖 Automation engine started');
}

async function runAllStrategies() {
  const all = autoStore.getAllStrategies();
  for (const s of all) {
    try {
      switch (s.type) {
        case 'DCA':           await runDCA(s); break;
        case 'TP_SL':         await runTPSL(s); break;
        case 'TRAILING_STOP': await runTrailingStop(s); break;
        case 'AUTO_SELL':     await runAutoSell(s); break;
      }
    } catch (err) {
      logger.error(`Strategy ${s.id} error:`, err.message);
    }
  }
}

// ─── DCA ─────────────────────────────────────────────────────────
// Buy a fixed SOL amount every X minutes

async function runDCA(s) {
  const now = Date.now();
  const intervalMs = s.intervalMinutes * 60 * 1000;
  if (now - (s.lastRun || 0) < intervalMs) return;

  // Check max orders
  if (s.maxOrders && s.filledOrders >= s.maxOrders) {
    await notify(s.chatId, `📋 DCA <b>${s.id}</b> completed — reached ${s.maxOrders} orders.`);
    autoStore.removeStrategy(s.chatId, s.id);
    return;
  }

  logger.info(`DCA executing: ${s.id} — ${s.solAmount} SOL → ${s.mint}`);
  autoStore.updateStrategy(s.chatId, s.id, { lastRun: now });

  const result = await executeBuy(s.chatId, s.mint, s.solAmount);
  const info = await getTokenInfo(s.mint);
  const filled = (s.filledOrders || 0) + 1;
  autoStore.updateStrategy(s.chatId, s.id, { filledOrders: filled });

  if (result.success) {
    await notify(s.chatId,
      `🔄 <b>DCA Order #${filled} Executed</b>\n\n` +
      `Token: <b>${info?.name || s.mint.slice(0,8)}</b>\n` +
      `Bought: <b>${s.solAmount} SOL</b>\n` +
      `Next order in: <b>${s.intervalMinutes} min</b>\n` +
      (s.maxOrders ? `Progress: <b>${filled}/${s.maxOrders}</b>\n` : '') +
      `🔗 <a href="https://solscan.io/tx/${result.sig}">Solscan</a>`
    );
  } else {
    await notify(s.chatId, `❌ <b>DCA Order #${filled} Failed</b>\n${result.error}\n\nStrategy <b>${s.id}</b> paused.`);
    autoStore.updateStrategy(s.chatId, s.id, { active: false });
  }
}

// ─── Take Profit / Stop Loss ──────────────────────────────────────

async function runTPSL(s) {
  const info = await getTokenInfo(s.mint);
  if (!info) return;

  const currentMc = info.usd_market_cap || 0;
  const entryMc   = s.entryMcap;

  const pctChange = ((currentMc - entryMc) / entryMc) * 100;

  const hitTP = s.takeProfitPct && pctChange >= s.takeProfitPct;
  const hitSL = s.stopLossPct   && pctChange <= -Math.abs(s.stopLossPct);

  if (!hitTP && !hitSL) return;

  const reason  = hitTP ? `🟢 Take Profit hit (+${pctChange.toFixed(1)}%)` : `🔴 Stop Loss hit (${pctChange.toFixed(1)}%)`;
  logger.info(`TP/SL triggered: ${s.id} — ${reason}`);

  autoStore.updateStrategy(s.chatId, s.id, { active: false });

  const result = await executeSell(s.chatId, s.mint, s.sellPct || 100);

  await notify(s.chatId,
    `${hitTP ? '🟢' : '🔴'} <b>TP/SL Triggered — ${s.id}</b>\n\n` +
    `Token: <b>${info.name}</b>\n` +
    `Reason: ${reason}\n` +
    `Sold: <b>${s.sellPct || 100}%</b> of holdings\n` +
    (result.success
      ? `🔗 <a href="https://solscan.io/tx/${result.sig}">View on Solscan</a>`
      : `❌ Sell failed: ${result.error}`)
  );
}

// ─── Trailing Stop Loss ───────────────────────────────────────────

async function runTrailingStop(s) {
  const info = await getTokenInfo(s.mint);
  if (!info) return;

  const currentMc = info.usd_market_cap || 0;

  // Update peak if price moved up
  if (currentMc > (s.peakMcap || 0)) {
    autoStore.updateStrategy(s.chatId, s.id, { peakMcap: currentMc });
    return;
  }

  const peak = s.peakMcap || s.entryMcap;
  const dropPct = ((peak - currentMc) / peak) * 100;

  if (dropPct < s.trailPct) return;

  logger.info(`Trailing stop triggered: ${s.id} — dropped ${dropPct.toFixed(1)}% from peak`);
  autoStore.updateStrategy(s.chatId, s.id, { active: false });

  const result = await executeSell(s.chatId, s.mint, s.sellPct || 100);

  await notify(s.chatId,
    `📉 <b>Trailing Stop Triggered — ${s.id}</b>\n\n` +
    `Token: <b>${info.name}</b>\n` +
    `Dropped <b>${dropPct.toFixed(1)}%</b> from peak\n` +
    `Peak MCap: <b>$${formatMc(peak)}</b>\n` +
    `Current MCap: <b>$${formatMc(currentMc)}</b>\n` +
    `Sold: <b>${s.sellPct || 100}%</b>\n` +
    (result.success
      ? `🔗 <a href="https://solscan.io/tx/${result.sig}">View on Solscan</a>`
      : `❌ Sell failed: ${result.error}`)
  );
}

// ─── Auto-Sell after X% gain or loss ─────────────────────────────

async function runAutoSell(s) {
  const info = await getTokenInfo(s.mint);
  if (!info) return;

  const currentMc = info.usd_market_cap || 0;
  const pctChange = ((currentMc - s.entryMcap) / s.entryMcap) * 100;

  const hitGain = s.gainPct  && pctChange >= s.gainPct;
  const hitLoss = s.lossPct  && pctChange <= -Math.abs(s.lossPct);

  if (!hitGain && !hitLoss) return;

  logger.info(`Auto-sell triggered: ${s.id} pct=${pctChange.toFixed(1)}%`);
  autoStore.updateStrategy(s.chatId, s.id, { active: false });

  const result = await executeSell(s.chatId, s.mint, s.sellPct || 100);

  await notify(s.chatId,
    `${hitGain ? '🚀' : '🛑'} <b>Auto-Sell Triggered — ${s.id}</b>\n\n` +
    `Token: <b>${info.name}</b>\n` +
    `Change: <b>${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%</b>\n` +
    `Trigger: ${hitGain ? `+${s.gainPct}% gain` : `-${s.lossPct}% loss`}\n` +
    `Sold: <b>${s.sellPct || 100}%</b>\n` +
    (result.success
      ? `🔗 <a href="https://solscan.io/tx/${result.sig}">View on Solscan</a>`
      : `❌ Sell failed: ${result.error}`)
  );
}

// ─── Shared Trade Helpers ─────────────────────────────────────────

async function executeBuy(chatId, mint, solAmount) {
  try {
    const balance = await getBalance(chatId);
    const fee = calculateFee(solAmount);
    if (balance < solAmount + fee + 0.001) throw new Error(`Insufficient balance (${balance.toFixed(4)} SOL)`);

    const publicKey = getPublicKey(chatId);
    const rawTx = await getBuyTransaction(mint, solAmount, publicKey);
    const sig = await signAndSendTransaction(chatId, new Uint8Array(rawTx));
    await collectFee(chatId, solAmount);
    return { success: true, sig };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function executeSell(chatId, mint, percent) {
  try {
    const tokenBalance = await getTokenBalance(chatId, mint);
    const tokenAmount = Math.floor((tokenBalance * percent) / 100);
    if (tokenAmount === 0) throw new Error('No tokens to sell');

    const publicKey = getPublicKey(chatId);
    const rawTx = await getSellTransaction(mint, tokenAmount, publicKey);
    const sig = await signAndSendTransaction(chatId, new Uint8Array(rawTx));
    await collectFee(chatId, 0.01);
    return { success: true, sig };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function notify(chatId, text) {
  try {
    await botRef.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    logger.warn(`Notify failed for ${chatId}: ${err.message}`);
  }
}

function formatMc(v) {
  if (!v) return '0';
  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v/1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

module.exports = { startAutomation };
