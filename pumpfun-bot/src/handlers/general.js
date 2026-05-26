const store = require('../utils/store');
const { getOrCreateWallet, getBalance } = require('../services/userWallet');

async function handleStart(bot, msg) {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name || 'Trader';
  const isNewUser = !store.hasWallet(chatId);

  const wallet = getOrCreateWallet(chatId);
  store.subscribeNewLaunches(chatId);

  // ── New user: show wallet creation notice first ──
  if (isNewUser) {
    await bot.sendMessage(
      chatId,
      `🎉 <b>Welcome to PumpBot, ${name}!</b>\n\n` +
      `A brand new Solana wallet has been created just for you:\n\n` +
      `👛 <b>Your Wallet Address:</b>\n` +
      `<code>${wallet.publicKey}</code>\n\n` +
      `📥 <b>Deposit SOL to this address to start trading.</b>\n\n` +
      `🔐 <b>Security tip:</b> Use <b>/exportkey</b> to back up your private key and import it into Phantom or any Solana wallet.`,
      { parse_mode: 'HTML' }
    );
  }

  const balance = await getBalance(chatId).catch(() => 0);

  // ── Main welcome message ──
  const welcomeText = isNewUser
    ? `⚡ <b>Your bot is ready. Here's what you can do:</b>`
    : `👋 <b>Welcome back, ${name}!</b>\n💰 Balance: <b>${balance.toFixed(4)} SOL</b>`;

  await bot.sendMessage(
    chatId,
    `${welcomeText}\n\n` +

    `╔═══════════════════════╗\n` +
    `║   💸  TRADING          ║\n` +
    `╚═══════════════════════╝\n` +
    `/buy <code>&lt;mint&gt; &lt;sol&gt;</code> — Buy a token\n` +
    `/sell <code>&lt;mint&gt; &lt;%&gt;</code> — Sell % of your holdings\n` +
    `/balance — Check your SOL balance\n\n` +

    `╔═══════════════════════╗\n` +
    `║   🎯  SNIPER           ║\n` +
    `╚═══════════════════════╝\n` +
    `/snipe <code>&lt;sol&gt; [maxMcap] [keyword]</code>\n` +
    `Auto-buy new launches matching your filter\n` +
    `/snipeoff — Stop the sniper\n\n` +

    `╔═══════════════════════╗\n` +
    `║   📡  TRACKING         ║\n` +
    `╚═══════════════════════╝\n` +
    `/track <code>&lt;mint&gt;</code> — Watch a token\n` +
    `/untrack <code>&lt;mint&gt;</code> — Remove from watchlist\n` +
    `/watchlist — View all tracked tokens\n\n` +

    `╔═══════════════════════╗\n` +
    `║   📊  RESEARCH         ║\n` +
    `╚═══════════════════════╝\n` +
    `/stats <code>&lt;mint&gt;</code> — Token stats & market cap\n` +
    `/chart <code>&lt;mint&gt;</code> — ASCII price chart\n\n` +

    `╔═══════════════════════╗\n` +
    `║   👛  WALLET           ║\n` +
    `╚═══════════════════════╝\n` +
    `/mywallet — Your address & balance\n` +
    `/exportkey — Export your private key

` +
    `╔═══════════════════════╗
` +
    `║   🤖  AUTOMATION       ║
` +
    `╚═══════════════════════╝
` +
    `/auto — Open automation menu
` +
    `/dca <code>&lt;mint&gt; &lt;sol&gt; &lt;min&gt;</code> — Dollar cost average
` +
    `/tpsl <code>&lt;mint&gt; &lt;mcap&gt; &lt;tp%&gt; &lt;sl%&gt;</code> — Take profit/stop loss
` +
    `/trail <code>&lt;mint&gt; &lt;trail%&gt;</code> — Trailing stop loss
` +
    `/autosell <code>&lt;mint&gt; &lt;mcap&gt; &lt;gain%&gt; &lt;loss%&gt;</code> — Auto sell
` +
    `/strategies — View & manage all strategies\n\n` +

    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💸 <b>Platform fee:</b> 1% per trade\n` +
    `⚡ <b>Network:</b> Solana Mainnet\n` +
    `🚀 <b>Powered by:</b> Pump.fun`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💼 My Wallet', callback_data: 'mywallet' },
            { text: '🔥 Trending Tokens', callback_data: 'stats:trending' },
          ],
          [
            { text: '🎯 How to Snipe', callback_data: 'help_snipe' },
            { text: '🛒 How to Buy', callback_data: 'help_buy' },
          ],
        ],
      },
    }
  );
}

async function handleHelp(bot, msg) {
  return handleStart(bot, msg);
}

async function handleMyWallet(bot, msg) {
  const chatId = msg.chat.id;
  const wallet = getOrCreateWallet(chatId);
  const balance = await getBalance(chatId).catch(() => 0);

  await bot.sendMessage(
    chatId,
    `👛 <b>Your Wallet</b>\n\n` +
    `📬 <b>Address:</b>\n<code>${wallet.publicKey}</code>\n\n` +
    `💰 <b>Balance:</b> ${balance.toFixed(4)} SOL\n\n` +
    `🔗 <a href="https://solscan.io/account/${wallet.publicKey}">View on Solscan</a>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📥 Send SOL to your address above to fund your wallet.\n` +
    `🔑 Use /exportkey to back up your private key.`,
    {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }
  );
}

async function handleExportKey(bot, msg) {
  const chatId = msg.chat.id;

  if (msg.chat.type !== 'private') {
    return bot.sendMessage(chatId, '🔒 For security, /exportkey only works in a private chat with the bot.');
  }

  const wallet = store.getUserWallet(chatId);
  if (!wallet) {
    return bot.sendMessage(chatId, '❌ No wallet found. Use /start first.');
  }

  await bot.sendMessage(
    chatId,
    `🔑 <b>Private Key Export</b>\n\n` +
    `⚠️ <b>NEVER share this with anyone.</b>\n` +
    `Anyone with this key has full access to your wallet.\n\n` +
    `<tg-spoiler><code>${wallet.privateKey}</code></tg-spoiler>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📲 <b>Import into Phantom:</b>\n` +
    `Settings → Import Wallet → Private Key\n\n` +
    `🗑️ <i>Delete this message after saving your key.</i>`,
    { parse_mode: 'HTML' }
  );
}

module.exports = { handleStart, handleHelp, handleMyWallet, handleExportKey };
