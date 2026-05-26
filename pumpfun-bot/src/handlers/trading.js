const { getBuyTransaction, getSellTransaction, getTokenInfo, formatMarketCap } = require('../services/pumpfun');
const { getBalance, getTokenBalance, signAndSendTransaction, getPublicKey } = require('../services/userWallet');
const { collectFee, calculateFee, FEE_PERCENT } = require('../services/fee');
const logger = require('../utils/logger');

/**
 * /buy <mint> <sol_amount>
 */
async function handleBuy(bot, msg, args, confirmed = false) {
  const chatId = msg.chat.id;

  let mint, solAmount;
  if (typeof args === 'string') {
    const parts = args.trim().split(/\s+/);
    if (parts.length === 1 && parts[0].includes(':')) {
      [mint, solAmount] = parts[0].split(':');
    } else {
      [mint, solAmount] = parts;
    }
  }

  solAmount = parseFloat(solAmount);

  if (!mint || isNaN(solAmount) || solAmount <= 0) {
    return bot.sendMessage(chatId, '❌ Usage: /buy <mint_address> <sol_amount>\nExample: /buy <code>ABC...xyz</code> 0.1', { parse_mode: 'HTML' });
  }

  const fee = calculateFee(solAmount);
  const totalCost = solAmount + fee;

  if (!confirmed) {
    const info = await getTokenInfo(mint);
    const name = info?.name || 'Unknown Token';
    const mc = formatMarketCap(info?.usd_market_cap);
    const balance = await getBalance(chatId).catch(() => 0);

    return bot.sendMessage(
      chatId,
      `🛒 <b>Confirm Buy Order</b>\n\n` +
        `Token: <b>${name}</b>\n` +
        `Market Cap: ${mc}\n` +
        `Mint: <code>${mint}</code>\n\n` +
        `💸 Trade Amount: <b>${solAmount} SOL</b>\n` +
        `🏦 Platform Fee (${FEE_PERCENT * 100}%): <b>${fee.toFixed(4)} SOL</b>\n` +
        `━━━━━━━━━━━━━━\n` +
        `💰 Total Cost: <b>${totalCost.toFixed(4)} SOL</b>\n` +
        `Your Balance: <b>${balance.toFixed(4)} SOL</b>\n\n` +
        `⚠️ Slippage: 10% | Priority fee: 0.0005 SOL`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Confirm Buy', callback_data: `buy_confirm:${mint}:${solAmount}` },
            { text: '❌ Cancel', callback_data: 'cancel' },
          ]],
        },
      }
    );
  }

  const statusMsg = await bot.sendMessage(chatId, '⏳ Building transaction...');

  try {
    const balance = await getBalance(chatId);
    if (balance < totalCost + 0.001) {
      return bot.editMessageText(
        `❌ Insufficient balance.\n\nNeeded: <b>${totalCost.toFixed(4)} SOL</b> (trade + fee)\nYou have: <b>${balance.toFixed(4)} SOL</b>\n\nDeposit to:\n<code>${getPublicKey(chatId)}</code>`,
        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
      );
    }

    await bot.editMessageText('⏳ Signing and sending trade transaction...', {
      chat_id: chatId, message_id: statusMsg.message_id,
    });

    const publicKey = getPublicKey(chatId);
    const rawTx = await getBuyTransaction(mint, solAmount, publicKey);
    const signature = await signAndSendTransaction(chatId, new Uint8Array(rawTx));

    // Collect fee after successful trade (non-blocking)
    await bot.editMessageText('⏳ Collecting platform fee...', {
      chat_id: chatId, message_id: statusMsg.message_id,
    });
    await collectFee(chatId, solAmount);

    const info = await getTokenInfo(mint);
    const newBalance = await getBalance(chatId);

    await bot.editMessageText(
      `✅ <b>Buy Successful!</b>\n\n` +
        `Token: <b>${info?.name || mint}</b>\n` +
        `Trade: <b>${solAmount} SOL</b>\n` +
        `Fee paid: <b>${fee.toFixed(4)} SOL</b>\n` +
        `New Balance: <b>${newBalance.toFixed(4)} SOL</b>\n\n` +
        `🔗 <a href="https://solscan.io/tx/${signature}">View Trade on Solscan</a>`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML', disable_web_page_preview: true }
    );

    logger.info(`BUY success: chatId=${chatId} mint=${mint} ${solAmount}SOL fee=${fee.toFixed(4)}SOL tx=${signature}`);
  } catch (err) {
    logger.error('handleBuy error:', err.message);
    await bot.editMessageText(`❌ <b>Transaction Failed</b>\n${err.message}`, {
      chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML',
    });
  }
}

/**
 * /sell <mint> <percent>
 */
async function handleSell(bot, msg, args, confirmed = false) {
  const chatId = msg.chat.id;

  let mint, percent;
  if (typeof args === 'string') {
    const parts = args.trim().split(/\s+/);
    [mint, percent] = parts;
  }

  percent = parseInt(percent, 10);

  if (!mint || isNaN(percent) || percent < 1 || percent > 100) {
    return bot.sendMessage(chatId, '❌ Usage: /sell <mint_address> <percent>\nExample: /sell <code>ABC...xyz</code> 100', { parse_mode: 'HTML' });
  }

  if (!confirmed) {
    const tokenBalance = await getTokenBalance(chatId, mint);
    const info = await getTokenInfo(mint);
    const name = info?.name || 'Unknown';

    if (tokenBalance === 0) {
      return bot.sendMessage(chatId, `❌ You don't hold any <b>${name}</b> tokens.`, { parse_mode: 'HTML' });
    }

    const sellAmount = Math.floor((tokenBalance * percent) / 100);
    const estimatedSol = (info?.sol_price || 0) * sellAmount;
    const fee = calculateFee(Math.max(estimatedSol, 0.01));

    return bot.sendMessage(
      chatId,
      `📤 <b>Confirm Sell Order</b>\n\n` +
        `Token: <b>${name}</b>\n` +
        `Selling: <b>${percent}%</b> (~${sellAmount.toLocaleString()} tokens)\n` +
        `Mint: <code>${mint}</code>\n\n` +
        `🏦 Platform Fee (${FEE_PERCENT * 100}%): ~<b>${fee.toFixed(4)} SOL</b>\n` +
        `(deducted from proceeds)`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Confirm Sell', callback_data: `sell_confirm:${mint}:${percent}` },
            { text: '❌ Cancel', callback_data: 'cancel' },
          ]],
        },
      }
    );
  }

  const statusMsg = await bot.sendMessage(chatId, '⏳ Building sell transaction...');

  try {
    const tokenBalance = await getTokenBalance(chatId, mint);
    const tokenAmount = Math.floor((tokenBalance * percent) / 100);

    if (tokenAmount === 0) {
      return bot.editMessageText('❌ No tokens to sell at this percentage.', {
        chat_id: chatId, message_id: statusMsg.message_id,
      });
    }

    await bot.editMessageText('⏳ Signing and sending sell transaction...', {
      chat_id: chatId, message_id: statusMsg.message_id,
    });

    const publicKey = getPublicKey(chatId);
    const rawTx = await getSellTransaction(mint, tokenAmount, publicKey);
    const signature = await signAndSendTransaction(chatId, new Uint8Array(rawTx));

    // Estimate SOL received and collect fee
    const balanceBefore = await getBalance(chatId);

    await bot.editMessageText('⏳ Collecting platform fee...', {
      chat_id: chatId, message_id: statusMsg.message_id,
    });

    // Use 1% of the trade value or minimum fee
    const estimatedSolReceived = 0.01; // conservative fallback
    await collectFee(chatId, estimatedSolReceived);

    const info = await getTokenInfo(mint);
    const newBalance = await getBalance(chatId);
    const fee = calculateFee(estimatedSolReceived);

    await bot.editMessageText(
      `✅ <b>Sell Successful!</b>\n\n` +
        `Token: <b>${info?.name || mint}</b>\n` +
        `Sold: <b>${percent}%</b> of holdings\n` +
        `Fee paid: <b>${fee.toFixed(4)} SOL</b>\n` +
        `SOL Balance: <b>${newBalance.toFixed(4)} SOL</b>\n\n` +
        `🔗 <a href="https://solscan.io/tx/${signature}">View Trade on Solscan</a>`,
      { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML', disable_web_page_preview: true }
    );

    logger.info(`SELL success: chatId=${chatId} mint=${mint} ${percent}% tx=${signature}`);
  } catch (err) {
    logger.error('handleSell error:', err.message);
    await bot.editMessageText(`❌ <b>Transaction Failed</b>\n${err.message}`, {
      chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML',
    });
  }
}

async function handleBalance(bot, msg) {
  const chatId = msg.chat.id;
  try {
    const balance = await getBalance(chatId);
    const pubKey = getPublicKey(chatId);
    await bot.sendMessage(
      chatId,
      `💼 <b>Your Wallet</b>\n\n` +
        `💰 Balance: <b>${balance.toFixed(4)} SOL</b>\n` +
        `📬 Address:\n<code>${pubKey}</code>\n\n` +
        `🔗 <a href="https://solscan.io/account/${pubKey}">View on Solscan</a>\n\n` +
        `Deposit SOL to the address above to start trading.`,
      { parse_mode: 'HTML', disable_web_page_preview: true }
    );
  } catch (err) {
    await bot.sendMessage(chatId, `❌ ${err.message}`);
  }
}

module.exports = { handleBuy, handleSell, handleBalance };
