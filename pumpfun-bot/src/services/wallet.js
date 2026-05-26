const {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const bs58 = require('bs58');
const logger = require('../utils/logger');

const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

let _connection = null;
let _wallet = null;

function getConnection() {
  if (!_connection) {
    _connection = new Connection(RPC_ENDPOINT, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return _connection;
}

function getWallet() {
  if (!_wallet) {
    if (!process.env.WALLET_PRIVATE_KEY) {
      throw new Error('WALLET_PRIVATE_KEY not set in .env');
    }
    const secretKey = bs58.decode(process.env.WALLET_PRIVATE_KEY);
    _wallet = Keypair.fromSecretKey(secretKey);
    logger.info(`Wallet loaded: ${_wallet.publicKey.toBase58()}`);
  }
  return _wallet;
}

async function getBalance() {
  const connection = getConnection();
  const wallet = getWallet();
  const lamports = await connection.getBalance(wallet.publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

async function getTokenBalance(mintAddress) {
  try {
    const connection = getConnection();
    const wallet = getWallet();
    const mint = new PublicKey(mintAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
      mint,
    });

    if (tokenAccounts.value.length === 0) return 0;
    const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
    return parseFloat(amount.uiAmount || 0);
  } catch (err) {
    logger.error(`getTokenBalance failed for ${mintAddress}:`, err.message);
    return 0;
  }
}

/**
 * Sign and send a raw transaction (Uint8Array)
 */
async function signAndSendTransaction(rawTx) {
  const connection = getConnection();
  const wallet = getWallet();

  const tx = VersionedTransaction.deserialize(rawTx);
  tx.sign([wallet]);

  const sig = await connection.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  // Wait for confirmation
  const confirmation = await connection.confirmTransaction(sig, 'confirmed');
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return sig;
}

function getPublicKey() {
  return getWallet().publicKey.toBase58();
}

module.exports = {
  getConnection,
  getWallet,
  getBalance,
  getTokenBalance,
  signAndSendTransaction,
  getPublicKey,
};
