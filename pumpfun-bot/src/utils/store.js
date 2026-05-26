/**
 * Simple in-memory store.
 * For production: replace with Redis or SQLite.
 */

const wallets = {};        // { chatId: { publicKey, privateKey (bs58) } }
const watchlist = {};      // { chatId: [mint, ...] }
const priceAlerts = {};    // { chatId: { mint: [{ id, type, value }] } }
const sniperConfigs = {};  // { chatId: { active, amount, maxMcap, minMcap, keyword } }
const snipedTokens = {};   // { chatId: Set<mint> }
const newLaunchSubs = new Set(); // Set<chatId>
let alertIdCounter = 1;

// ─── Per-User Wallets ─────────────────────────────────────────────

function saveUserWallet(chatId, publicKey, privateKey) {
  wallets[String(chatId)] = { publicKey, privateKey };
}

function getUserWallet(chatId) {
  return wallets[String(chatId)] || null;
}

function hasWallet(chatId) {
  return !!wallets[String(chatId)];
}

// ─── Watchlist ────────────────────────────────────────────────────

function addToWatchlist(chatId, mint) {
  if (!watchlist[chatId]) watchlist[chatId] = [];
  if (!watchlist[chatId].includes(mint)) {
    watchlist[chatId].push(mint);
    return true;
  }
  return false;
}

function removeFromWatchlist(chatId, mint) {
  if (!watchlist[chatId]) return false;
  const before = watchlist[chatId].length;
  watchlist[chatId] = watchlist[chatId].filter((m) => m !== mint);
  return watchlist[chatId].length < before;
}

function getWatchlist() {
  return watchlist;
}

function getUserWatchlist(chatId) {
  return watchlist[chatId] || [];
}

// ─── New Launch Subscribers ───────────────────────────────────────

function subscribeNewLaunches(chatId) {
  newLaunchSubs.add(String(chatId));
}

function unsubscribeNewLaunches(chatId) {
  newLaunchSubs.delete(String(chatId));
}

function isSubscribed(chatId) {
  return newLaunchSubs.has(String(chatId));
}

function getNewLaunchSubscribers() {
  return [...newLaunchSubs];
}

// ─── Price Alerts ─────────────────────────────────────────────────

function addPriceAlert(chatId, mint, type, value) {
  if (!priceAlerts[chatId]) priceAlerts[chatId] = {};
  if (!priceAlerts[chatId][mint]) priceAlerts[chatId][mint] = [];
  const id = alertIdCounter++;
  priceAlerts[chatId][mint].push({ id, type, value });
  return id;
}

function getPriceAlerts(chatId, mint) {
  return (priceAlerts[chatId] && priceAlerts[chatId][mint]) || [];
}

function removePriceAlert(chatId, mint, alertId) {
  if (!priceAlerts[chatId] || !priceAlerts[chatId][mint]) return;
  priceAlerts[chatId][mint] = priceAlerts[chatId][mint].filter((a) => a.id !== alertId);
}

// ─── Sniper ───────────────────────────────────────────────────────

function setSniperConfig(chatId, config) {
  sniperConfigs[String(chatId)] = { active: true, ...config };
}

function getSniperConfig(chatId) {
  return sniperConfigs[String(chatId)] || null;
}

function getAllSniperConfigs() {
  return sniperConfigs;
}

function disableSniper(chatId) {
  if (sniperConfigs[String(chatId)]) {
    sniperConfigs[String(chatId)].active = false;
    return true;
  }
  return false;
}

function markSniped(chatId, mint) {
  const key = String(chatId);
  if (!snipedTokens[key]) snipedTokens[key] = new Set();
  snipedTokens[key].add(mint);
}

function hasSniped(chatId, mint) {
  const key = String(chatId);
  return snipedTokens[key] ? snipedTokens[key].has(mint) : false;
}

module.exports = {
  saveUserWallet,
  getUserWallet,
  hasWallet,
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
  getUserWatchlist,
  subscribeNewLaunches,
  unsubscribeNewLaunches,
  isSubscribed,
  getNewLaunchSubscribers,
  addPriceAlert,
  getPriceAlerts,
  removePriceAlert,
  setSniperConfig,
  getSniperConfig,
  getAllSniperConfigs,
  disableSniper,
  markSniped,
  hasSniped,
};
