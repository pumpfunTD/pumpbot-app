const autoStore = require('../utils/autoStore');
const { getTokenInfo, formatMarketCap } = require('../services/pumpfun');

// ─── /auto — Main automation menu ────────────────────────────────

async function handleAuto(bot, msg) {
  const chatId = msg.chat.id;
  const strategies = autoStore.getUserStrategies(chatId);
  const active = strategies.filter((s) => s.active).length;

  await bot.sendMessage(
    chatId,
    `🤖 <b>Automated Trading</b>\n\n` +
    `Active strategies: <b>${active}</b>\n\n` +
    `Choose a strategy to set up:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 DCA — Dollar Cost Average', callback_data: 'auto_setup:DCA' }],
          [{ text: '🎯 Take Profit / Stop Loss',   callback_data: 'auto_setup:TP_SL' }],
          [{ text: '📉 Trailing Stop Loss',         callback_data: 'auto_setup:TRAILING' }],
          [{ text: '⚡ Auto-Sell on % Move',        callback_data: 'auto_setup:AUTO_SELL' }],
          [{ text: '📋 My Active Strategies',       callback_data: 'auto_list' }],
        ],
      },
    }
  );
}

// ─── Strategy setup explainers ────────────────────────────────────

async function handleAutoSetup(bot, msg, type) {
  const chatId = msg.chat.id;

  const info = {
    DCA: {
      icon: '🔄',
      name: 'Dollar Cost Average (DCA)',
      desc: 'Automatically buys a fixed SOL amount at regular intervals. Great for accumulating tokens over time without timing the market.',
      usage: '/dca &lt;mint&gt; &lt;sol_per_order&gt; &lt;interval_minutes&gt; [max_orders]\n\nExamples:\n• /dca ABC...xyz 0.1 60\n  → Buy 0.1 SOL every 60 min\n• /dca ABC...xyz 0.05 30 10\n  → Buy 0.05 SOL every 30 min, 10 times',
    },
    TP_SL: {
      icon: '🎯',
      name: 'Take Profit / Stop Loss',
      desc: 'Automatically sells when the token gains or drops a set percentage from your entry market cap.',
      usage: '/tpsl &lt;mint&gt; &lt;entry_mcap_usd&gt; [take_profit_%] [stop_loss_%] [sell_%]\n\nExamples:\n• /tpsl ABC...xyz 50000 100 50\n  → Sell all at +100% gain or -50% loss\n• /tpsl ABC...xyz 50000 200 30 50\n  → Sell 50% of holdings at +200% or -30%',
    },
    TRAILING: {
      icon: '📉',
      name: 'Trailing Stop Loss',
      desc: 'Follows the price upward and automatically sells if the price drops more than X% from its peak. Locks in profits while staying in the trade.',
      usage: '/trail &lt;mint&gt; &lt;trail_%&gt; [sell_%]\n\nExamples:\n• /trail ABC...xyz 20\n  → Sell all if price drops 20% from peak\n• /trail ABC...xyz 15 50\n  → Sell 50% if price drops 15% from peak',
    },
    AUTO_SELL: {
      icon: '⚡',
      name: 'Auto-Sell on % Move',
      desc: 'Triggers an automatic sell when the token moves up or down by a set percentage from your entry.',
      usage: '/autosell &lt;mint&gt; &lt;entry_mcap_usd&gt; [gain_%] [loss_%] [sell_%]\n\nExamples:\n• /autosell ABC...xyz 50000 50 25\n  → Sell at +50% gain or -25% loss\n• /autosell ABC...xyz 50000 300\n  → Sell only on +300% gain',
    },
  };

  const s = info[type];
  if (!s) return;

  await bot.sendMessage(
    chatId,
    `${s.icon} <b>${s.name}</b>\n\n` +
    `${s.desc}\n\n` +
    `<b>Command:</b>\n<code>${s.usage}</code>`,
    { parse_mode: 'HTML' }
  );
}

// ─── /dca <mint> <sol> <interval_min> [max_orders] ───────────────

async function handleDCA(bot, msg, args) {
  const chatId = msg.chat.id;
  const parts = args.trim().split(/\s+/);
  const [mint, solStr, intervalStr, maxStr] = parts;

  const solAmount = parseFloat(solStr);
  const intervalMinutes = parseInt(intervalStr, 10);
  const maxOrders = maxStr ? parseInt(maxStr, 10) : null;

  if (!mint || isNaN(solAmount) || isNaN(intervalMinutes)) {
    return bot.sendMessage(chatId,
      '❌ Usage: /dca <mint> <sol_per_order> <interval_minutes> [max_orders]\n\n' +
      'Example: /dca <code>ABC...xyz</code> 0.1 60 10',
      { parse_mode: 'HTML' }
    );
  }

  const info = await getTokenInfo(mint);
  const name = info?.name || mint.slice(0, 12) + '...';
  const mc = formatMarketCap(info?.usd_market_cap);

  const id = autoStore.addStrategy(chatId, {
    type: 'DCA',
    mint,
    solAmount,
    intervalMinutes,
    maxOrders,
    filledOrders: 0,
    lastRun: 0,
  });

  await bot.sendMessage(chatId,
    `✅ <b>DCA Strategy Created — ${id}</b>\n\n` +
    `Token: <b>${name}</b>\n` +
    `Market Cap: ${mc}\n` +
    `Per Order: <b>${solAmount} SOL</b>\n` +
    `Interval: <b>every ${intervalMinutes} min</b>\n` +
    (maxOrders ? `Max Orders: <b>${maxOrders}</b>\n` : `Orders: <b>unlimited</b>\n`) +
    `\n⚡ First order executes in ${intervalMinutes} min.\n` +
    `Use /strategies to view or cancel.`,
    { parse_mode: 'HTML' }
  );
}

// ─── /tpsl <mint> <entry_mcap> [tp%] [sl%] [sell%] ───────────────

async function handleTPSL(bot, msg, args) {
  const chatId = msg.chat.id;
  const parts = args.trim().split(/\s+/);
  const [mint, entryStr, tpStr, slStr, sellStr] = parts;

  const entryMcap = parseFloat(entryStr);
  const takeProfitPct = tpStr ? parseFloat(tpStr) : null;
  const stopLossPct = slStr ? parseFloat(slStr) : null;
  const sellPct = sellStr ? parseInt(sellStr, 10) : 100;

  if (!mint || isNaN(entryMcap) || (!takeProfitPct && !stopLossPct)) {
    return bot.sendMessage(chatId,
      '❌ Usage: /tpsl <mint> <entry_mcap_usd> [take_profit_%] [stop_loss_%] [sell_%]\n\n' +
      'Example: /tpsl <code>ABC...xyz</code> 50000 100 50',
      { parse_mode: 'HTML' }
    );
  }

  const info = await getTokenInfo(mint);
  const name = info?.name || mint.slice(0, 12) + '...';

  const id = autoStore.addStrategy(chatId, {
    type: 'TP_SL',
    mint,
    entryMcap,
    takeProfitPct,
    stopLossPct,
    sellPct,
  });

  await bot.sendMessage(chatId,
    `✅ <b>TP/SL Strategy Created — ${id}</b>\n\n` +
    `Token: <b>${name}</b>\n` +
    `Entry MCap: <b>$${entryMcap.toLocaleString()}</b>\n` +
    (takeProfitPct ? `🟢 Take Profit: <b>+${takeProfitPct}%</b>\n` : '') +
    (stopLossPct   ? `🔴 Stop Loss:   <b>-${stopLossPct}%</b>\n`   : '') +
    `Sell: <b>${sellPct}%</b> of holdings\n\n` +
    `📡 Monitoring price every 20 seconds.\n` +
    `Use /strategies to view or cancel.`,
    { parse_mode: 'HTML' }
  );
}

// ─── /trail <mint> <trail%> [sell%] ──────────────────────────────

async function handleTrail(bot, msg, args) {
  const chatId = msg.chat.id;
  const parts = args.trim().split(/\s+/);
  const [mint, trailStr, sellStr] = parts;

  const trailPct = parseFloat(trailStr);
  const sellPct = sellStr ? parseInt(sellStr, 10) : 100;

  if (!mint || isNaN(trailPct)) {
    return bot.sendMessage(chatId,
      '❌ Usage: /trail <mint> <trail_%> [sell_%]\n\n' +
      'Example: /trail <code>ABC...xyz</code> 20',
      { parse_mode: 'HTML' }
    );
  }

  const info = await getTokenInfo(mint);
  const name = info?.name || mint.slice(0, 12) + '...';
  const currentMc = info?.usd_market_cap || 0;

  const id = autoStore.addStrategy(chatId, {
    type: 'TRAILING_STOP',
    mint,
    trailPct,
    sellPct,
    entryMcap: currentMc,
    peakMcap: currentMc,
  });

  await bot.sendMessage(chatId,
    `✅ <b>Trailing Stop Created — ${id}</b>\n\n` +
    `Token: <b>${name}</b>\n` +
    `Current MCap: <b>${formatMarketCap(currentMc)}</b>\n` +
    `Trail Distance: <b>${trailPct}%</b> below peak\n` +
    `Sell: <b>${sellPct}%</b> of holdings\n\n` +
    `📡 Peak MCap tracked in real-time.\n` +
    `Triggers when price drops ${trailPct}% from highest point.\n` +
    `Use /strategies to view or cancel.`,
    { parse_mode: 'HTML' }
  );
}

// ─── /autosell <mint> <entry_mcap> [gain%] [loss%] [sell%] ───────

async function handleAutoSell(bot, msg, args) {
  const chatId = msg.chat.id;
  const parts = args.trim().split(/\s+/);
  const [mint, entryStr, gainStr, lossStr, sellStr] = parts;

  const entryMcap = parseFloat(entryStr);
  const gainPct = gainStr ? parseFloat(gainStr) : null;
  const lossPct = lossStr ? parseFloat(lossStr) : null;
  const sellPct = sellStr ? parseInt(sellStr, 10) : 100;

  if (!mint || isNaN(entryMcap) || (!gainPct && !lossPct)) {
    return bot.sendMessage(chatId,
      '❌ Usage: /autosell <mint> <entry_mcap_usd> [gain_%] [loss_%] [sell_%]\n\n' +
      'Example: /autosell <code>ABC...xyz</code> 50000 50 25',
      { parse_mode: 'HTML' }
    );
  }

  const info = await getTokenInfo(mint);
  const name = info?.name || mint.slice(0, 12) + '...';

  const id = autoStore.addStrategy(chatId, {
    type: 'AUTO_SELL',
    mint,
    entryMcap,
    gainPct,
    lossPct,
    sellPct,
  });

  await bot.sendMessage(chatId,
    `✅ <b>Auto-Sell Created — ${id}</b>\n\n` +
    `Token: <b>${name}</b>\n` +
    `Entry MCap: <b>$${entryMcap.toLocaleString()}</b>\n` +
    (gainPct ? `🚀 Sell on gain: <b>+${gainPct}%</b>\n` : '') +
    (lossPct ? `🛑 Sell on loss: <b>-${lossPct}%</b>\n` : '') +
    `Sell: <b>${sellPct}%</b> of holdings\n\n` +
    `📡 Checking price every 20 seconds.\n` +
    `Use /strategies to view or cancel.`,
    { parse_mode: 'HTML' }
  );
}

// ─── /strategies — list & manage ─────────────────────────────────

async function handleStrategies(bot, msg) {
  const chatId = msg.chat.id;
  const list = autoStore.getUserStrategies(chatId);

  if (list.length === 0) {
    return bot.sendMessage(chatId,
      `📋 <b>No active strategies.</b>\n\n` +
      `Use /auto to set one up.`,
      { parse_mode: 'HTML' }
    );
  }

  const lines = list.map((s) => {
    const icon = { DCA: '🔄', TP_SL: '🎯', TRAILING_STOP: '📉', AUTO_SELL: '⚡' }[s.type] || '⚙️';
    const status = s.active ? '🟢' : '⏸️';
    const detail = strategyDetail(s);
    return `${status} ${icon} <b>${s.id}</b> — ${s.type}\n${detail}`;
  });

  const keyboard = list.map((s) => ([
    { text: `❌ Cancel ${s.id}`, callback_data: `auto_cancel:${s.id}` },
    { text: `${s.active ? '⏸ Pause' : '▶️ Resume'} ${s.id}`, callback_data: `auto_pause:${s.id}` },
  ]));

  await bot.sendMessage(chatId,
    `📋 <b>Your Strategies (${list.length})</b>\n\n` + lines.join('\n\n'),
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard },
    }
  );
}

function strategyDetail(s) {
  switch (s.type) {
    case 'DCA':
      return `  ${s.solAmount} SOL every ${s.intervalMinutes}min | Orders: ${s.filledOrders || 0}${s.maxOrders ? `/${s.maxOrders}` : ''}`;
    case 'TP_SL':
      return `  TP: ${s.takeProfitPct ? '+' + s.takeProfitPct + '%' : '—'} | SL: ${s.stopLossPct ? '-' + s.stopLossPct + '%' : '—'} | Sell ${s.sellPct}%`;
    case 'TRAILING_STOP':
      return `  Trail: ${s.trailPct}% | Peak: $${(s.peakMcap/1000).toFixed(1)}K | Sell ${s.sellPct}%`;
    case 'AUTO_SELL':
      return `  Gain: ${s.gainPct ? '+'+s.gainPct+'%' : '—'} | Loss: ${s.lossPct ? '-'+s.lossPct+'%' : '—'} | Sell ${s.sellPct}%`;
    default:
      return '';
  }
}

// ─── Cancel / Pause callbacks ─────────────────────────────────────

async function handleAutoCancel(bot, msg, id) {
  const chatId = msg.chat.id;
  const removed = autoStore.removeStrategy(chatId, id);
  await bot.sendMessage(chatId,
    removed ? `🗑️ Strategy <b>${id}</b> cancelled.` : `❌ Strategy <b>${id}</b> not found.`,
    { parse_mode: 'HTML' }
  );
}

async function handleAutoPause(bot, msg, id) {
  const chatId = msg.chat.id;
  const isNowActive = autoStore.pauseStrategy(chatId, id);
  if (isNowActive === null) return bot.sendMessage(chatId, `❌ Strategy <b>${id}</b> not found.`, { parse_mode: 'HTML' });
  await bot.sendMessage(chatId,
    isNowActive
      ? `▶️ Strategy <b>${id}</b> resumed.`
      : `⏸️ Strategy <b>${id}</b> paused.`,
    { parse_mode: 'HTML' }
  );
}

module.exports = {
  handleAuto,
  handleAutoSetup,
  handleDCA,
  handleTPSL,
  handleTrail,
  handleAutoSell,
  handleStrategies,
  handleAutoCancel,
  handleAutoPause,
};
