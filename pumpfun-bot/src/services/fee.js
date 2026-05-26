const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const { loadKeypair, getConnection } = require('./userWallet');
const logger = require('../utils/logger');

// ─── Config ───────────────────────────────────────────────────────
const FEE_RECIPIENT = '6xU8KJaXVXjxS2K2UoBxXyhQ85dCLJDkivgpb38NvgsG';
const FEE_PERCENT = 0.01; // 1% of trade amount
const MIN_FEE_SOL = 0.001; // minimum 0.001 SOL per trade

/**
 * Calculate fee for a given SOL trade amount.
 * @param {number} solAmount
 * @returns {number} fee in SOL
 */
function calculateFee(solAmount) {
  return Math.max(solAmount * FEE_PERCENT, MIN_FEE_SOL);
}

/**
 * Send platform fee from user's wallet to the fee recipient.
 * Runs after a successful trade. Failures are logged but don't block the user.
 * @param {string|number} chatId
 * @param {number} solAmount - original trade amount in SOL
 * @returns {string|null} transaction signature or null on failure
 */
async function collectFee(chatId, solAmount) {
  try {
    const feeSol = calculateFee(solAmount);
    const feeLamports = Math.floor(feeSol * LAMPORTS_PER_SOL);

    const connection = getConnection();
    const keypair = loadKeypair(chatId);
    const recipient = new PublicKey(FEE_RECIPIENT);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: recipient,
        lamports: feeLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;

    const sig = await sendAndConfirmTransaction(connection, tx, [keypair], {
      commitment: 'confirmed',
    });

    logger.info(`Fee collected: ${feeSol.toFixed(4)} SOL from chatId=${chatId} | tx=${sig}`);
    return sig;
  } catch (err) {
    // Non-blocking — log but don't throw
    logger.warn(`Fee collection failed for chatId=${chatId}: ${err.message}`);
    return null;
  }
}

module.exports = { collectFee, calculateFee, FEE_PERCENT, MIN_FEE_SOL, FEE_RECIPIENT };
