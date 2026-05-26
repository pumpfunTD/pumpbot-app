require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { handleStart, handleHelp, handleMyWallet, handleExportKey } = require('./handlers/general');
const { handleBuy, handleSell, handleBalance } = require('./handlers/trading');
const { handleTrack, handleUntrack, handleWatchlist } = require('./handlers/tracking');
const { handleSnipe, handleSnipeOff } = require('./handlers/sniper');
const { handleStats, handleChart } = require('./handlers/stats');
const {
  handleAuto, handleAutoSetup,
  handleDCA, handleTPSL, handleTrail, handleAutoSell,
  handleStrategies, handleAutoCancel, handleAutoPause,
} = require('./handlers/automation');
const { startMonitoring } = require('./services/monitor');
const { startAutomation } = require('./services/automation');
const { setupMiniApp } = require('./services/miniapp');
const logger = require('./utils/logger');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
logger.info('🚀 PumpFun Trading Bot starting...');

// ─── General ──────────────────────────────────────────────────────
bot.onText(/\/start/,     (msg) => handleStart(bot, msg));
bot.onText(/\/help/,      (msg) => handleHelp(bot, msg));
bot.onText(/\/mywallet/,  (msg) => handleMyWallet(bot, msg));
bot.onText(/\/exportkey/, (msg) => handleExportKey(bot, msg));
bot.onText(/\/balance/,   (msg) => handleBalance(bot, msg));

// ─── Trading ──────────────────────────────────────────────────────
bot.onText(/\/buy (.+)/,  (msg, m) => handleBuy(bot, msg, m[1]));
bot.onText(/\/sell (.+)/, (msg, m) => handleSell(bot, msg, m[1]));

// ─── Tracking ─────────────────────────────────────────────────────
bot.onText(/\/track (.+)/,   (msg, m) => handleTrack(bot, msg, m[1]));
bot.onText(/\/untrack (.+)/, (msg, m) => handleUntrack(bot, msg, m[1]));
bot.onText(/\/watchlist/,    (msg) => handleWatchlist(bot, msg));

// ─── Sniper ───────────────────────────────────────────────────────
bot.onText(/\/snipe (.+)/, (msg, m) => handleSnipe(bot, msg, m[1]));
bot.onText(/\/snipeoff/,   (msg) => handleSnipeOff(bot, msg));

// ─── Stats ────────────────────────────────────────────────────────
bot.onText(/\/stats (.+)/, (msg, m) => handleStats(bot, msg, m[1]));
bot.onText(/\/chart (.+)/, (msg, m) => handleChart(bot, msg, m[1]));

// ─── Automation ───────────────────────────────────────────────────
bot.onText(/\/auto/,               (msg) => handleAuto(bot, msg));
bot.onText(/\/strategies/,         (msg) => handleStrategies(bot, msg));
bot.onText(/\/dca (.+)/,           (msg, m) => handleDCA(bot, msg, m[1]));
bot.onText(/\/tpsl (.+)/,          (msg, m) => handleTPSL(bot, msg, m[1]));
bot.onText(/\/trail (.+)/,         (msg, m) => handleTrail(bot, msg, m[1]));
bot.onText(/\/autosell (.+)/,      (msg, m) => handleAutoSell(bot, msg, m[1]));

// ─── Callbacks ────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const [action, ...args] = query.data.split(':');
  const msg = { chat: { id: query.message.chat.id, type: query.message.chat.type }, from: query.from };
  await bot.answerCallbackQuery(query.id);

  switch (action) {
    case 'buy_confirm':    await handleBuy(bot, msg, args.join(':'), true); break;
    case 'sell_confirm':   await handleSell(bot, msg, args.join(':'), true); break;
    case 'stats':          await handleStats(bot, msg, args[0]); break;
    case 'chart':          await handleChart(bot, msg, args[0]); break;
    case 'track':          await handleTrack(bot, msg, args[0]); break;
    case 'mywallet':       await handleMyWallet(bot, msg); break;
    case 'balance':        await handleBalance(bot, msg); break;
    case 'auto_setup':     await handleAutoSetup(bot, msg, args[0]); break;
    case 'auto_list':      await handleStrategies(bot, msg); break;
    case 'auto_cancel':    await handleAutoCancel(bot, msg, args[0]); break;
    case 'auto_pause':     await handleAutoPause(bot, msg, args[0]); break;
    case 'cancel':         await bot.sendMessage(msg.chat.id, '❌ Cancelled.'); break;
    default: logger.warn(`Unknown callback: ${action}`);
  }
});

// ─── Background services ──────────────────────────────────────────
startMonitoring(bot);
startAutomation(bot);
setupMiniApp(bot);

bot.on('polling_error', (err) => logger.error('Polling error:', err.message));
logger.info('✅ Bot is live and polling');
