// call-context.js
// ─────────────────────────────────────────────────────────────────────────────
// In-memory store mapping sessionId → lead context.
// sessionId = `${lead.phone}-${Date.now()}` — no Twilio dependency.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, object>} sessionId → lead object */
const sessionMap = new Map();

/** @type {Map<string, {attempts: number, lead: object}>} phone → retry state */
const retryMap   = new Map();

// ── Session Context ───────────────────────────────────────────────────────────

function setLeadContext(sessionId, lead) {
  sessionMap.set(sessionId, lead);
}

function getLeadContext(sessionId) {
  return sessionMap.get(sessionId) || null;
}

function clearLeadContext(sessionId) {
  sessionMap.delete(sessionId);
}

// ── Retry State ───────────────────────────────────────────────────────────────

function getRetryCount(phone) {
  return retryMap.get(phone)?.attempts || 0;
}

function incrementRetry(phone, lead) {
  const current = retryMap.get(phone) || { attempts: 0, lead };
  retryMap.set(phone, { attempts: current.attempts + 1, lead });
}

function clearRetry(phone) {
  retryMap.delete(phone);
}

function getRetryLead(phone) {
  return retryMap.get(phone)?.lead || null;
}

module.exports = {
  setLeadContext,
  getLeadContext,
  clearLeadContext,
  getRetryCount,
  incrementRetry,
  clearRetry,
  getRetryLead,
};
