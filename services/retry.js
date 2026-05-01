// ─────────────────────────────────────────────────────────────────────────────
// services/retry.js — Retry system for unanswered calls
// If a lead does not answer → retry after 5 min → retry again after 15 min
// Max 3 attempts per lead
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES   = 3;
const RETRY_DELAYS  = [5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000]; // 5m, 15m, 30m

/** In-memory retry queue (survives server restart with Redis, fine for now) */
const retryQueue = new Map(); // phone → { attempts, lead, timerId }

/**
 * Schedule a retry call for a lead that did not answer.
 * @param {object} lead      - Full lead object { name, phone, ... }
 * @param {Function} callFn  - async function(lead) → triggers the actual call
 */
function scheduleRetry(lead, callFn) {
  const phone    = lead.phone;
  const existing = retryQueue.get(phone) || { attempts: 0, lead };
  const attempt  = existing.attempts;

  if (attempt >= MAX_RETRIES) {
    console.log(`⛔ Max retries reached for ${phone}. Giving up.`);
    retryQueue.delete(phone);
    return;
  }

  const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
  const minutes = Math.round(delay / 60000);

  console.log(`🔁 Scheduling retry ${attempt + 1}/${MAX_RETRIES} for ${phone} in ${minutes} minutes`);

  // Clear any existing timer for this phone
  if (existing.timerId) clearTimeout(existing.timerId);

  const timerId = setTimeout(async () => {
    console.log(`📞 Retry attempt ${attempt + 1} for ${phone}`);
    try {
      const result = await callFn(lead);
      if (result?.answered) {
        console.log(`✅ Lead ${phone} answered on retry ${attempt + 1}`);
        retryQueue.delete(phone);
      } else {
        // Schedule next retry
        retryQueue.set(phone, { attempts: attempt + 1, lead, timerId: null });
        scheduleRetry(lead, callFn);
      }
    } catch (err) {
      console.error(`Retry call error for ${phone}:`, err.message);
      retryQueue.set(phone, { attempts: attempt + 1, lead, timerId: null });
      scheduleRetry(lead, callFn);
    }
  }, delay);

  retryQueue.set(phone, { attempts: attempt + 1, lead, timerId });
}

/**
 * Cancel retries for a lead (e.g. they answered or booked).
 */
function cancelRetry(phone) {
  const entry = retryQueue.get(phone);
  if (entry?.timerId) clearTimeout(entry.timerId);
  retryQueue.delete(phone);
  console.log(`✅ Cancelled retries for ${phone}`);
}

/**
 * Get retry status for a phone number.
 */
function getRetryStatus(phone) {
  const entry = retryQueue.get(phone);
  return entry ? { scheduled: true, attempts: entry.attempts } : { scheduled: false, attempts: 0 };
}

module.exports = { scheduleRetry, cancelRetry, getRetryStatus };
