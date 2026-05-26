const {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const bs58 = require('bs58');
const store = require('../utils/store');
const logger = require('../utils/logger');

const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

let _connection = null;

function getConnection() {
  if (!_connection) {
    _connection = new Connection(RPC_ENDPOINT, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return _connection;
}

/**
 * Generate a brand-new Solana wallet for a user and persist it.
 * Returns { publicKey, privateKey (bs58) }
 */
function generateWalletForUser(chatId) {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey.toBase58();
  const privateKey = bs58.encode(keypair.secretKey);

  store.saveUserWallet(chatId, publicKey, privateKey);
  logger.info(`Generated wallet for chatId ${chatId}: ${publicKey}`);

  return { publicKey, privateKey };
}

/**
 * Get or create a wallet for a user.
 * Returns { publicKey, privateKey }
 */
function getOrCreateWallet(chatId) {
  const existing = store.getUserWallet(chatId);
  if (existing) return existing;
  return generateWalletForUser(chatId);
}

/**
 * Load a Keypair from the user's stored private key.
 */
function loadKeypair(chatId) {
  const w = store.getUserWallet(chatId);
  if (!w) throw new Error('No wallet found for this user. Use /start to create one.');
  return Keypair.fromSecretKey(bs58.decode(w.privateKey));
}

/**
 * Get SOL balance for a user's wallet.
 */
async function getBalance(chatId) {
  const w = store.getUserWallet(chatId);
  if (!w) return 0;
  const connection = getConnection();
  const lamports = await connection.getBalance(new PublicKey(w.publicKey));
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Get token balance for a user's wallet.
 */
async function getTokenBalance(chatId, mintAddress) {
  try {
    const w = store.getUserWallet(chatId);
    if (!w) return 0;
    const connection = getConnection();
    const mint = new PublicKey(mintAddress);
    const owner = new PublicKey(w.publicKey);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
    if (tokenAccounts.value.length === 0) return 0;
    return parseFloat(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0);
  } catch (err) {
    logger.error(`getTokenBalance failed:`, err.message);
    return 0;
  }
}

/**
 * Sign and send a raw transaction using the user's keypair.
 */
async function signAndSendTransaction(chatId, rawTx) {
  const connection = getConnection();
  const keypair = loadKeypair(chatId);

  const tx = VersionedTransaction.deserialize(rawTx);
  tx.sign([keypair]);

  const sig = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
  const confirmation = await connection.confirmTransaction(sig, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return sig;
}

/**
 * Get user's public key string.
 */
function getPublicKey(chatId) {
  const w = store.getUserWallet(chatId);
  if (!w) throw new Error('No wallet found. Use /start to create one.');
  return w.publicKey;
}

module.exports = {
  generateWalletForUser,
  getOrCreateWallet,
  loadKeypair,
  getBalance,
  getTokenBalance,
  signAndSendTransaction,
  getPublicKey,
  getConnection,
};
