const { getNewCoins, getTokenInfo, formatMarketCap } = require('./pumpfun');
const store = require('../utils/store');
const logger = require('../utils/logger');

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const SNIPE_CHECK_MS = 5_000;    // 5 seconds for sniper

let monitorInterval = null;
let snipeInterval = null;
let seenMints = new Set();
let botRef = null;

/**
 * Start background monitoring loops
 */
function startMonitoring(bot) {
  botRef = bot;
  logger.info('📡 Starting token monitor...');

  // New launch monitor
  monitorInterval = setInterval(async () => {
    try {
      await checkNewLaunches();
    } catch (err) {
      logger.error('Monitor loop error:', err.message);
    }
  }, POLL_INTERVAL_MS);

  // Sniper loop (faster)
  snipeInterval = setInterval(async () => {
    try {
      await runSniper();
    } catch (err) {
      logger.error('Sniper loop error:', err.message);
    }
  }, SNIPE_CHECK_MS);

  // Initial seed to avoid flood on startup
  seedSeenMints();
}

async function seedSeenMints() {
  const coins = await getNewCoins(50);
  coins.forEach((c) => seenMints.add(c.mint));
  logger.info(`Seeded ${seenMints.size} existing mints`);
}

/**
 * Check for newly launched tokens and notify tracking users
 */
async function checkNewLaunches() {
  const coins = await getNewCoins(20);
  const watchlist = store.getWatchlist();
  const sniperConfig = store.getSniperConfig();

  for (const coin of coins) {
    // New token alert to all subscribed chats
    if (!seenMints.has(coin.mint)) {
      seenMints.add(coin.mint);
      const subscribers = store.getNewLaunchSubscribers();

      if (subscribers.length > 0) {
        const msg = formatNewLaunchAlert(coin);
        for (const chatId of subscribers) {
          await safeNotify(chatId, msg, launchKeyboard(coin.mint));
        }
      }
    }

    // Price alerts for watchlisted tokens
    for (const [chatId, mints] of Object.entries(watchlist)) {
      if (mints.includes(coin.mint)) {
        await checkPriceAlerts(chatId, coin);
      }
    }
  }
}

async function checkPriceAlerts(chatId, coin) {
  const alerts = store.getPriceAlerts(chatId, coin.mint);
  for (const alert of alerts) {
    const mcUsd = coin.usd_market_cap || 0;
    if (alert.type === 'above' && mcUsd >= alert.value) {
      await safeNotify(chatId, `🔔 <b>${coin.name}</b> hit market cap ${formatMarketCap(mcUsd)}!\n<code>${coin.mint}</code>`);
      store.removePriceAlert(chatId, coin.mint, alert.id);
    } else if (alert.type === 'below' && mcUsd <= alert.value) {
      await safeNotify(chatId, `🔔 <b>${coin.name}</b> dropped to ${formatMarketCap(mcUsd)}!\n<code>${coin.mint}</code>`);
      store.removePriceAlert(chatId, coin.mint, alert.id);
    }
  }
}

/**
 * Auto-sniper: buys new tokens matching criteria
 */
async function runSniper() {
  const configs = store.getAllSniperConfigs();
  if (Object.keys(configs).length === 0) return;

  const coins = await getNewCoins(5);

  for (const coin of coins) {
    for (const [chatId, cfg] of Object.entries(configs)) {
      if (!cfg.active) continue;
      if (store.hasSniped(chatId, coin.mint)) continue;

      const mcUsd = coin.usd_market_cap || 0;
      const passes =
        (!cfg.maxMcap || mcUsd <= cfg.maxMcap) &&
        (!cfg.minMcap || mcUsd >= cfg.minMcap) &&
        (!cfg.keyword || coin.name?.toLowerCase().includes(cfg.keyword.toLowerCase()));

      if (passes) {
        store.markSniped(chatId, coin.mint);
        logger.info(`🎯 Sniper triggered: ${coin.name} (${coin.mint}) for chat ${chatId}`);

        await safeNotify(
          chatId,
          `🎯 <b>Sniper Alert!</b>\nNew token matches your criteria!\n\n` +
            `<b>${coin.name}</b> (${coin.symbol})\n` +
            `Market Cap: ${formatMarketCap(mcUsd)}\n` +
            `<code>${coin.mint}</code>`,
          snipeActionKeyboard(coin.mint, cfg.amount)
        );
      }
    }
  }
}

function formatNewLaunchAlert(coin) {
  return (
    `🚀 <b>New Token Launched!</b>\n\n` +
    `<b>${coin.name}</b> (${coin.symbol})\n` +
    `💰 Market Cap: ${formatMarketCap(coin.usd_market_cap)}\n` +
    `👤 Creator: <code>${coin.creator?.slice(0, 8)}...</code>\n` +
    `🔗 <code>${coin.mint}</code>`
  );
}

function launchKeyboard(mint) {
  return {
    inline_keyboard: [
      [
        { text: '📊 Stats', callback_data: `stats:${mint}` },
        { text: '📌 Track', callback_data: `track:${mint}` },
        { text: '🛒 Buy 0.1 SOL', callback_data: `buy_confirm:${mint}:0.1` },
      ],
    ],
  };
}

function snipeActionKeyboard(mint, amount = 0.1) {
  return {
    inline_keyboard: [
      [
        { text: `⚡ Buy ${amount} SOL`, callback_data: `buy_confirm:${mint}:${amount}` },
        { text: '📊 Stats', callback_data: `stats:${mint}` },
      ],
    ],
  };
}

async function safeNotify(chatId, text, reply_markup = null) {
  try {
    await botRef.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(reply_markup ? { reply_markup } : {}),
    });
  } catch (err) {
    logger.warn(`Failed to notify ${chatId}: ${err.message}`);
  }
}

module.exports = { startMonitoring };
