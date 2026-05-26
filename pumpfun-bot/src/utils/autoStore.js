/**
 * Automation strategy store.
 * Stores DCA, TP/SL, Trailing Stop, and Auto-sell configs per user.
 */

const strategies = {}; // { chatId: { id: strategyObject } }
let strategyCounter = 1;

function _ensure(chatId) {
  const k = String(chatId);
  if (!strategies[k]) strategies[k] = {};
  return k;
}

// ─── Create / Delete ──────────────────────────────────────────────

function addStrategy(chatId, strategy) {
  const k = _ensure(chatId);
  const id = `S${strategyCounter++}`;
  strategies[k][id] = { id, active: true, createdAt: Date.now(), ...strategy };
  return id;
}

function removeStrategy(chatId, id) {
  const k = String(chatId);
  if (strategies[k] && strategies[k][id]) {
    delete strategies[k][id];
    return true;
  }
  return false;
}

function pauseStrategy(chatId, id) {
  const k = String(chatId);
  if (strategies[k] && strategies[k][id]) {
    strategies[k][id].active = !strategies[k][id].active;
    return strategies[k][id].active;
  }
  return null;
}

// ─── Query ────────────────────────────────────────────────────────

function getUserStrategies(chatId) {
  const k = String(chatId);
  return Object.values(strategies[k] || {});
}

function getAllStrategies() {
  const all = [];
  for (const [chatId, map] of Object.entries(strategies)) {
    for (const s of Object.values(map)) {
      if (s.active) all.push({ chatId, ...s });
    }
  }
  return all;
}

function getStrategy(chatId, id) {
  const k = String(chatId);
  return (strategies[k] && strategies[k][id]) || null;
}

function updateStrategy(chatId, id, patch) {
  const k = String(chatId);
  if (strategies[k] && strategies[k][id]) {
    Object.assign(strategies[k][id], patch);
    return true;
  }
  return false;
}

module.exports = {
  addStrategy,
  removeStrategy,
  pauseStrategy,
  getUserStrategies,
  getAllStrategies,
  getStrategy,
  updateStrategy,
};
