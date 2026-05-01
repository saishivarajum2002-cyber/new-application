// ─────────────────────────────────────────────────────────────────────────────
// services/followup.js — Automatic WhatsApp Follow-Up Scheduler
// ─────────────────────────────────────────────────────────────────────────────
// When a new lead comes in:
//   Day 0 (instant)  → Welcome + property intro
//   Day 1 (24h)      → "Did you get a chance to look?"
//   Day 2 (48h)      → Social proof + urgency
//   Day 3 (72h)      → Final push + direct booking link
//
// Each message is warm, human, conversational — not salesy.
// Stops automatically if lead books a visit.
// ─────────────────────────────────────────────────────────────────────────────

const { sendWhatsAppText } = require('./whatsapp');

const AGENT_NAME    = process.env.AGENT_NAME    || 'Priya';
const COMPANY_NAME  = process.env.COMPANY_NAME  || 'Dream Homes Realty';
const VERCEL_URL    = process.env.BASE_URL       || 'https://real-estate-web-liard-rho.vercel.app';

// ── In-memory follow-up queue ─────────────────────────────────────────────────
// { phone → { lead, timers: [t1, t2, t3], cancelled: false } }
const followUpQueue = new Map();

// ── MESSAGE TEMPLATES — Day by day ────────────────────────────────────────────

function msg_day0(lead) {
  return `🏠 *${COMPANY_NAME}*

Hi ${lead.name || 'there'}! 👋

Thank you for your interest in ${lead.property_interest || 'our properties'}.

I'm *${AGENT_NAME}*, your personal property consultant. I'm here to help you find the perfect home — whether it's for your family or as a smart investment.

${lead.property_interest ? `We have some *excellent ${lead.property_interest} options* that match exactly what you're looking for.` : 'We have a wide range of properties that might be perfect for you.'}

${lead.budget ? `And great news — we have options well within your *${lead.budget} budget*! 🎉` : ''}

I'd love to show you what we have. Would you like to *book a quick visit* this week?

Just reply *"Yes"* and I'll arrange everything for you! 😊

_${AGENT_NAME} @ ${COMPANY_NAME}_`;
}

function msg_day1(lead) {
  return `🏠 *${COMPANY_NAME}*

Hi ${lead.name || 'there'}! 

Just checking in — I shared some details about our ${lead.property_interest || 'properties'} yesterday. Did you get a chance to think about it? 🙂

I know finding the right property takes time, and I don't want you to miss out on some really *fantastic options* we currently have available.

Here's what makes our listings special:
✅ Prime locations
✅ Ready to move in
✅ Flexible payment options
✅ Trusted developers

A *quick 20-minute visit* is all it takes to know if it's the right fit. No pressure at all!

Would *tomorrow or the day after* work for a visit?

_${AGENT_NAME} @ ${COMPANY_NAME}_`;
}

function msg_day2(lead) {
  return `🏠 *${COMPANY_NAME}*

Hi ${lead.name || 'there'}! 

I wanted to share something exciting with you. 🎉

One of our clients — who had similar requirements to yours — visited last week and *fell in love* with a property they thought was "just to check." They signed within 2 days!

The right property has a way of feeling like home the moment you walk in. And that feeling is hard to describe — you just have to *see it for yourself*.

We currently have ${lead.property_interest || 'properties'} that are getting a LOT of interest this week. I'd hate for you to miss the best ones.

👉 Can I *book a slot for you this weekend?* It's completely free and no obligation.

Just reply with your preferred time and I'll confirm right away! ⏰

_${AGENT_NAME} @ ${COMPANY_NAME}_`;
}

function msg_day3(lead) {
  return `🏠 *${COMPANY_NAME}*

Hi ${lead.name || 'there'}, 

This is my last follow-up — I promise I won't keep bothering you after this! 😊

I just wanted to give you one final nudge because I genuinely believe we have something *perfect for you*.

${lead.property_interest ? `Our *${lead.property_interest}* listings are moving fast this month.` : 'Our best properties are moving fast this month.'}
${lead.budget ? `And within *${lead.budget}*, the options are really strong right now.` : ''}

If you're still interested, I'm here to help — no pressure, no rush.

📅 *Book a free visit:*
${VERCEL_URL}

Or just reply *"Book"* and I'll set everything up for you in minutes.

Thank you for your time ${lead.name || ''}. I hope to help you find your dream home soon! 🏡

_${AGENT_NAME} @ ${COMPANY_NAME}_`;
}

// ── SCHEDULE follow-ups for a new lead ───────────────────────────────────────
function scheduleFollowUps(lead) {
  const phone = lead.phone;
  if (!phone) return;

  // Cancel any existing follow-ups for this number
  cancelFollowUps(phone);

  const timers = [];

  // Day 0 — send immediately (3 seconds after lead arrives)
  const t0 = setTimeout(async () => {
    const entry = followUpQueue.get(phone);
    if (entry?.cancelled) return;
    console.log(`📱 Follow-up Day 0 → ${lead.name} (${phone})`);
    await sendWhatsAppText(phone, msg_day0(lead));
  }, 3000);
  timers.push(t0);

  // Day 1 — 24 hours later
  const t1 = setTimeout(async () => {
    const entry = followUpQueue.get(phone);
    if (entry?.cancelled) return;
    console.log(`📱 Follow-up Day 1 → ${lead.name} (${phone})`);
    await sendWhatsAppText(phone, msg_day1(lead));
  }, 24 * 60 * 60 * 1000);
  timers.push(t1);

  // Day 2 — 48 hours later
  const t2 = setTimeout(async () => {
    const entry = followUpQueue.get(phone);
    if (entry?.cancelled) return;
    console.log(`📱 Follow-up Day 2 → ${lead.name} (${phone})`);
    await sendWhatsAppText(phone, msg_day2(lead));
  }, 48 * 60 * 60 * 1000);
  timers.push(t2);

  // Day 3 — 72 hours later
  const t3 = setTimeout(async () => {
    const entry = followUpQueue.get(phone);
    if (entry?.cancelled) return;
    console.log(`📱 Follow-up Day 3 → ${lead.name} (${phone})`);
    await sendWhatsAppText(phone, msg_day3(lead));
    // Auto-remove after final message
    followUpQueue.delete(phone);
  }, 72 * 60 * 60 * 1000);
  timers.push(t3);

  followUpQueue.set(phone, { lead, timers, cancelled: false });
  console.log(`📅 Follow-ups scheduled for ${lead.name} (${phone}) — Day 0, 1, 2, 3`);
}

// ── CANCEL follow-ups (when lead books a visit) ───────────────────────────────
function cancelFollowUps(phone) {
  const entry = followUpQueue.get(phone);
  if (!entry) return;
  entry.timers.forEach(t => clearTimeout(t));
  entry.cancelled = true;
  followUpQueue.delete(phone);
  console.log(`✅ Follow-ups cancelled for ${phone} (booked or opted out)`);
}

// ── GET queue status ──────────────────────────────────────────────────────────
function getFollowUpStatus(phone) {
  const entry = followUpQueue.get(phone);
  return {
    scheduled: !!entry && !entry.cancelled,
    lead:      entry?.lead?.name || null,
  };
}

function getAllScheduled() {
  const list = [];
  followUpQueue.forEach((entry, phone) => {
    if (!entry.cancelled) {
      list.push({ phone, name: entry.lead?.name, interest: entry.lead?.property_interest });
    }
  });
  return list;
}

module.exports = {
  scheduleFollowUps,
  cancelFollowUps,
  getFollowUpStatus,
  getAllScheduled,
};
