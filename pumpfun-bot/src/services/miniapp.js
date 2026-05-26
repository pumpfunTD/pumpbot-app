const { handleBuy, handleSell } = require('../handlers/trading');
const { handleAutoCancel, handleAutoPause } = require('../handlers/automation');
const logger = require('../utils/logger');

/**
 * Register the Mini App button on /start and handle data sent from the web app.
 * Call setupMiniApp(bot) once after bot is created.
 */
function setupMiniApp(bot) {
  const WEBAPP_URL = process.env.WEBAPP_URL;
  if (!WEBAPP_URL) {
    logger.warn('WEBAPP_URL not set — Mini App button disabled');
    return;
  }

  // /app command — opens the mini app
  bot.onText(/\/app/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId,
      `📱 <b>Open PumpBot Dashboard</b>\n\nTap the button below to open your trading dashboard.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '📊 Open Dashboard', web_app: { url: WEBAPP_URL } }
          ]],
        },
      }
    );
  });

  // Handle data sent FROM the Mini App via Telegram.WebApp.sendData()
  bot.on('message', async (msg) => {
    if (!msg.web_app_data) return;

    const chatId = msg.chat.id;
    let data;
    try {
      data = JSON.parse(msg.web_app_data.data);
    } catch {
      logger.warn('Invalid web_app_data:', msg.web_app_data.data);
      return;
    }

    logger.info(`Mini App action from ${chatId}:`, data.action);

    switch (data.action) {
      case 'buy':
        await handleBuy(bot, msg, `${data.mint} ${data.amount}`, true);
        break;

      case 'sell':
        await handleSell(bot, msg, `${data.mint} ${data.amount}`, true);
        break;

      case 'strategy_toggle':
        await handleAutoPause(bot, msg, data.id);
        break;

      case 'strategy_cancel':
        await handleAutoCancel(bot, msg, data.id);
        break;

      case 'open_auto_menu': {
        const { handleAuto } = require('../handlers/automation');
        await handleAuto(bot, msg);
        break;
      }

      default:
        logger.warn('Unknown mini app action:', data.action);
    }
  });

  logger.info(`✅ Mini App registered at ${WEBAPP_URL}`);
}

module.exports = { setupMiniApp };
