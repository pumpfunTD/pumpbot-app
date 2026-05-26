const { getTokenInfo, getTokenTrades, getTrendingCoins, formatMarketCap, formatSol } = require('../services/pumpfun');

async function handleStats(bot, msg, mint) {
  const chatId = msg.chat.id;

  if (mint === 'trending') {
    return handleTrending(bot, chatId);
  }

  mint = mint?.trim();
  if (!mint || mint.length < 30) {
    return bot.sendMessage(chatId, '❌ Usage: /stats <mint_address>');
  }

  const statusMsg = await bot.sendMessage(chatId, '⏳ Fetching token data...');

  const info = await getTokenInfo(mint);
  if (!info) {
    return bot.editMessageText('❌ Token not found. Make sure it exists on Pump.fun.', {
      chat_id: chatId,
      message_id: statusMsg.message_id,
    });
  }

  const mc = formatMarketCap(info.usd_market_cap);
  const solPrice = formatSol(info.sol_price || 0);
  const progress = info.bonding_curve_progress || 0;
  const progressBar = makeProgressBar(progress);
  const age = info.created_timestamp ? timeAgo(info.created_timestamp) : 'Unknown';

  const text =
    `📊 <b>${info.name}</b> (<b>${info.symbol}</b>)\n\n` +
    `💰 Market Cap: <b>${mc}</b>\n` +
    `💵 Price: <b>${solPrice} SOL</b>\n` +
    `📈 Bonding Progress: ${progressBar} ${progress.toFixed(1)}%\n` +
    `⏱️ Age: ${age}\n` +
    `👤 Creator: <code>${info.creator?.slice(0, 12)}...</code>\n` +
    `📝 Description: ${info.description?.slice(0, 100) || 'N/A'}\n\n` +
    `🔗 <code>${mint}</code>`;

  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: statusMsg.message_id,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📈 Chart', callback_data: `chart:${mint}` },
          { text: '📌 Track', callback_data: `track:${mint}` },
        ],
        [
          { text: '🛒 Buy 0.1 SOL', callback_data: `buy_confirm:${mint}:0.1` },
          { text: '🛒 Buy 0.5 SOL', callback_data: `buy_confirm:${mint}:0.5` },
        ],
        [{ text: '🔗 View on Pump.fun', url: `https://pump.fun/coin/${mint}` }],
      ],
    },
  });
}

async function handleChart(bot, msg, mint) {
  const chatId = msg.chat.id;
  mint = mint?.trim();

  if (!mint || mint.length < 30) {
    return bot.sendMessage(chatId, '❌ Usage: /chart <mint_address>');
  }

  const statusMsg = await bot.sendMessage(chatId, '⏳ Fetching trade history...');

  const trades = await getTokenTrades(mint, 30);

  if (!trades || trades.length === 0) {
    return bot.editMessageText('❌ No trade history found.', {
      chat_id: chatId,
      message_id: statusMsg.message_id,
    });
  }

  const info = await getTokenInfo(mint);
  const chart = buildAsciiChart(trades);

  await bot.editMessageText(
    `📈 <b>${info?.name || mint.slice(0, 8) + '...'}</b> — Last ${trades.length} trades\n\n` +
      `<pre>${chart}</pre>`,
    {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML',
    }
  );
}

async function handleTrending(bot, chatId) {
  const statusMsg = await bot.sendMessage(chatId, '⏳ Fetching trending tokens...');
  const coins = await getTrendingCoins(10);

  if (!coins.length) {
    return bot.editMessageText('❌ Could not fetch trending tokens.', {
      chat_id: chatId,
      message_id: statusMsg.message_id,
    });
  }

  const lines = coins.map((c, i) => {
    const mc = formatMarketCap(c.usd_market_cap);
    const progress = (c.bonding_curve_progress || 0).toFixed(1);
    return `${i + 1}. <b>${c.name}</b> (${c.symbol}) — ${mc} | ${progress}%\n   <code>${c.mint}</code>`;
  });

  await bot.editMessageText(
    `🔥 <b>Trending on Pump.fun</b>\n\n` + lines.join('\n\n'),
    {
      chat_id: chatId,
      message_id: statusMsg.message_id,
      parse_mode: 'HTML',
    }
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function makeProgressBar(percent) {
  const filled = Math.round(percent / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function buildAsciiChart(trades) {
  // Extract sol prices per trade, newest last
  const prices = trades
    .slice()
    .reverse()
    .map((t) => parseFloat(t.sol_amount || 0));

  if (prices.length === 0) return 'No data';

  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const range = max - min || 1;
  const height = 8;
  const width = Math.min(prices.length, 40);

  // Build grid
  const grid = Array.from({ length: height }, () => Array(width).fill(' '));

  const slice = prices.slice(-width);
  slice.forEach((p, x) => {
    const y = height - 1 - Math.round(((p - min) / range) * (height - 1));
    grid[Math.max(0, Math.min(height - 1, y))][x] = '●';
  });

  const rows = grid.map((row) => '│' + row.join('') + '│');
  const border = '└' + '─'.repeat(width) + '┘';
  const label = `  min:${min.toFixed(4)}SOL  max:${max.toFixed(4)}SOL`;

  return rows.join('\n') + '\n' + border + '\n' + label;
}

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

module.exports = { handleStats, handleChart };
