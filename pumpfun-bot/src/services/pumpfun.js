const axios = require('axios');
const logger = require('../utils/logger');

const PUMP_API = 'https://client-api-2-74b1891ee9f9.herokuapp.com';
const PUMP_TRADE_API = 'https://pumpportal.fun/api';

/**
 * Fetch token metadata from Pump.fun
 */
async function getTokenInfo(mintAddress) {
  try {
    const res = await axios.get(`${PUMP_API}/coins/${mintAddress}`, { timeout: 8000 });
    return res.data;
  } catch (err) {
    logger.error(`getTokenInfo failed for ${mintAddress}:`, err.message);
    return null;
  }
}

/**
 * Fetch newest coins listed on Pump.fun
 */
async function getNewCoins(limit = 20) {
  try {
    const res = await axios.get(`${PUMP_API}/coins`, {
      params: { offset: 0, limit, sort: 'created_timestamp', order: 'DESC', includeNsfw: false },
      timeout: 8000,
    });
    return res.data || [];
  } catch (err) {
    logger.error('getNewCoins failed:', err.message);
    return [];
  }
}

/**
 * Fetch top trending coins
 */
async function getTrendingCoins(limit = 10) {
  try {
    const res = await axios.get(`${PUMP_API}/coins`, {
      params: { offset: 0, limit, sort: 'market_cap', order: 'DESC', includeNsfw: false },
      timeout: 8000,
    });
    return res.data || [];
  } catch (err) {
    logger.error('getTrendingCoins failed:', err.message);
    return [];
  }
}

/**
 * Get trade history for a token
 */
async function getTokenTrades(mintAddress, limit = 20) {
  try {
    const res = await axios.get(`${PUMP_API}/trades/all/${mintAddress}`, {
      params: { limit, minimumSize: 0 },
      timeout: 8000,
    });
    return res.data || [];
  } catch (err) {
    logger.error(`getTokenTrades failed for ${mintAddress}:`, err.message);
    return [];
  }
}

/**
 * Get a signed buy transaction from PumpPortal
 * @param {string} mint - Token mint address
 * @param {number} solAmount - Amount of SOL to spend
 * @param {string} publicKey - Trader's public key
 * @param {number} slippage - Slippage in percentage (default 10)
 */
async function getBuyTransaction(mint, solAmount, publicKey, slippage = 10) {
  try {
    const res = await axios.post(
      `${PUMP_TRADE_API}/trade-local`,
      {
        publicKey,
        action: 'buy',
        mint,
        denominatedInSol: 'true',
        amount: solAmount,
        slippage,
        priorityFee: 0.0005,
        pool: 'pump',
      },
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    return res.data; // raw transaction bytes
  } catch (err) {
    logger.error('getBuyTransaction failed:', err.message);
    throw new Error(`Failed to build buy transaction: ${err.message}`);
  }
}

/**
 * Get a signed sell transaction from PumpPortal
 * @param {string} mint - Token mint address
 * @param {number} tokenAmount - Percentage of tokens to sell (e.g. 100 = 100%)
 * @param {string} publicKey - Trader's public key
 * @param {number} slippage - Slippage in percentage
 */
async function getSellTransaction(mint, tokenAmount, publicKey, slippage = 10) {
  try {
    const res = await axios.post(
      `${PUMP_TRADE_API}/trade-local`,
      {
        publicKey,
        action: 'sell',
        mint,
        denominatedInSol: 'false',
        amount: tokenAmount,
        slippage,
        priorityFee: 0.0005,
        pool: 'pump',
      },
      { responseType: 'arraybuffer', timeout: 15000 }
    );
    return res.data;
  } catch (err) {
    logger.error('getSellTransaction failed:', err.message);
    throw new Error(`Failed to build sell transaction: ${err.message}`);
  }
}

/**
 * Format market cap for display
 */
function formatMarketCap(mc) {
  if (!mc) return 'N/A';
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  return `$${mc.toFixed(2)}`;
}

/**
 * Format SOL price
 */
function formatSol(lamports) {
  return (lamports / 1e9).toFixed(4);
}

module.exports = {
  getTokenInfo,
  getNewCoins,
  getTrendingCoins,
  getTokenTrades,
  getBuyTransaction,
  getSellTransaction,
  formatMarketCap,
  formatSol,
};
