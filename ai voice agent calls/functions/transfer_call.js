// transfer_call.js
// ─────────────────────────────────────────────────────────────────────────────
// Transfers the call to a human agent.
// Since we use SIM-based calling (no Twilio), transfer means:
//   1. Notify the agent via WhatsApp to call the lead back immediately
//   2. Return a message for AI to speak to the lead
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const fetch = require('node-fetch');

const transfer_call = async function ({ sessionId, reason = 'user_requested' }) {
  console.log(`transfer_call → session: ${sessionId}, reason: ${reason}`.magenta);

  const transferNumber = process.env.TRANSFER_NUMBER;
  const backendUrl     = process.env.PROPEDGE_BACKEND_URL || 'https://real-estate-web-liard-rho.vercel.app';

  if (!transferNumber) {
    console.warn('transfer_call → TRANSFER_NUMBER not set in .env'.yellow);
    return {
      status:  'notify_sent',
      message: "I've flagged this for our senior agent. They will call you back within a few minutes.",
    };
  }

  try {
    // Notify the human agent via the backend WhatsApp service
    await fetch(`${backendUrl}/api/leads/takeover-notify`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentPhone: transferNumber,
        reason,
        sessionId,
        message: `🔥 TRANSFER REQUEST\nReason: ${reason}\nSession: ${sessionId}\nCall the lead back immediately!`,
      }),
    });

    console.log(`transfer_call → Agent notified at ${transferNumber}`.green);
    return {
      status:  'notify_sent',
      message: "I've just alerted our senior agent. They will call you back within the next few minutes. Is there anything else I can note down for them?",
    };
  } catch (err) {
    console.error('transfer_call → Notify failed:'.red, err.message);
    return {
      status:  'failed',
      message: "I've noted your request. Our agent will follow up with you shortly.",
    };
  }
};

module.exports = transfer_call;
