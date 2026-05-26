const store = require('../utils/store');

/**
 * /snipe <sol_amount> [maxMcap_in_usd] [keyword]
 * Example: /snipe 0.1 50000 pepe
 */
async function handleSnipe(bot, msg, args) {
  const chatId = msg.chat.id;
  const parts = args.trim().split(/\s+/);

  const amount = parseFloat(parts[0]);
  const maxMcap = parts[1] ? parseFloat(parts[1]) : null;
  const keyword = parts[2] || null;

  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(
      chatId,
      '❌ Usage: /snipe <sol_amount> [max_market_cap_usd] [keyword]\n\nExamples:\n' +
        '• /snipe 0.1\n' +
        '• /snipe 0.1 50000\n' +
        '• /snipe 0.1 50000 pepe',
      { parse_mode: 'HTML' }
    );
  }

  store.setSniperConfig(chatId, { amount, maxMcap, keyword });

  let criteria = `💰 Buy: <b>${amount} SOL</b>`;
  if (maxMcap) criteria += `\n📊 Max MCap: <b>$${maxMcap.toLocaleString()}</b>`;
  if (keyword) criteria += `\n🔍 Keyword: <b>${keyword}</b>`;

  await bot.sendMessage(
    chatId,
    `🎯 <b>Sniper Activated!</b>\n\n` +
      criteria +
      `\n\nYou'll receive alerts when new tokens match your criteria, with a quick-buy button.\n\n` +
      `Use /snipeoff to disable.`,
    { parse_mode: 'HTML' }
  );
}

async function handleSnipeOff(bot, msg) {
  const chatId = msg.chat.id;
  const disabled = store.disableSniper(chatId);

  if (!disabled) {
    return bot.sendMessage(chatId, '⚠️ Sniper was not active.');
  }

  await bot.sendMessage(chatId, '🔴 Sniper disabled.');
}

module.exports = { handleSnipe, handleSnipeOff };
