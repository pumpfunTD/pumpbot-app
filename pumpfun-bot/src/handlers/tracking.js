const store = require('../utils/store');
const { getTokenInfo, formatMarketCap } = require('../services/pumpfun');

async function handleTrack(bot, msg, mint) {
  const chatId = msg.chat.id;
  mint = mint?.trim();

  if (!mint || mint.length < 30) {
    return bot.sendMessage(chatId, '❌ Usage: /track <mint_address>');
  }

  const info = await getTokenInfo(mint);
  const name = info?.name || mint.slice(0, 8) + '...';
  const added = store.addToWatchlist(chatId, mint);

  if (!added) {
    return bot.sendMessage(chatId, `⚠️ <b>${name}</b> is already in your watchlist.`, { parse_mode: 'HTML' });
  }

  await bot.sendMessage(
    chatId,
    `📌 <b>Tracking ${name}</b>\n` +
      `Market Cap: ${formatMarketCap(info?.usd_market_cap)}\n` +
      `Mint: <code>${mint}</code>\n\n` +
      `You'll receive alerts for this token.`,
    { parse_mode: 'HTML' }
  );
}

async function handleUntrack(bot, msg, mint) {
  const chatId = msg.chat.id;
  mint = mint?.trim();

  const removed = store.removeFromWatchlist(chatId, mint);

  if (!removed) {
    return bot.sendMessage(chatId, `⚠️ Token not found in your watchlist.`);
  }

  await bot.sendMessage(chatId, `🗑️ Removed <code>${mint.slice(0, 12)}...</code> from watchlist.`, { parse_mode: 'HTML' });
}

async function handleWatchlist(bot, msg) {
  const chatId = msg.chat.id;
  const mints = store.getUserWatchlist(chatId);

  if (mints.length === 0) {
    return bot.sendMessage(chatId, '📋 Your watchlist is empty.\nUse /track <mint> to add tokens.');
  }

  const statusMsg = await bot.sendMessage(chatId, `⏳ Fetching ${mints.length} tokens...`);

  const lines = await Promise.all(
    mints.map(async (mint, i) => {
      const info = await getTokenInfo(mint);
      const name = info?.name || 'Unknown';
      const mc = formatMarketCap(info?.usd_market_cap);
      return `${i + 1}. <b>${name}</b> — ${mc}\n   <code>${mint}</code>`;
    })
  );

  await bot.editMessageText(
    `📋 <b>Your Watchlist</b> (${mints.length} tokens)\n\n` + lines.join('\n\n'),
    {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML',
    }
  );
}

module.exports = { handleTrack, handleUntrack, handleWatchlist };
