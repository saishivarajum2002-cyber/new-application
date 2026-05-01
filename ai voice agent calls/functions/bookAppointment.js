// bookAppointment.js
// ─────────────────────────────────────────────────────────────────────────────
// Called by Aria when lead confirms a visit date and time.
// Uses sessionId (not Twilio callSid) to look up lead context.
// Hits the PropEdge backend to create a confirmed booking.
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const fetch = require('node-fetch');
const { getLeadContext } = require('../services/call-context');

/**
 * @param {string} sessionId        - Session ID (auto-injected by GptService)
 * @param {string} visit_date       - ISO date e.g. "2026-05-10"
 * @param {string} visit_time       - Time e.g. "11:00 AM"
 * @param {string} property_interest - Property name/type (optional)
 */
const bookAppointment = async function ({ sessionId, visit_date, visit_time, property_interest }) {
  console.log(`bookAppointment → session: ${sessionId}, date: ${visit_date}, time: ${visit_time}`.cyan);

  if (!visit_date || !visit_time) {
    return {
      success: false,
      message: "I need both a date and time to confirm the visit. Which date works best for you?",
    };
  }

  const lead       = getLeadContext(sessionId) || {};
  const backendUrl = process.env.PROPEDGE_BACKEND_URL || 'https://real-estate-web-liard-rho.vercel.app';
  const agentEmail = process.env.AGENT_EMAIL;

  const visitPayload = {
    agentEmail,
    is_ai_booking: true,
    visit: {
      client_name:       lead.name              || 'AI Lead',
      client_phone:      lead.phone             || null,
      client_email:      lead.email             || null,
      property_name:     property_interest      || lead.property_interest || 'Property Visit',
      visit_date,
      visit_time,
      notes:   `Booked by AI Agent Aria — session: ${sessionId}`,
      status:  'confirmed',
    },
  };

  try {
    const response = await fetch(`${backendUrl}/api/visits`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visitPayload),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`bookAppointment → Saved. ID: ${result.id}`.green);
      return {
        success:    true,
        booking_id: result.id,
        message:    `I've confirmed your visit for ${visit_date} at ${visit_time}. You'll receive the details on your WhatsApp shortly!`,
      };
    }

    // Slot already taken
    if (result.error && result.error.toLowerCase().includes('already booked')) {
      return {
        success: false,
        message: "That slot is already taken — would a different morning or afternoon time work for you?",
      };
    }

    return {
      success: false,
      message: "I had a small issue saving that. Our agent will confirm your visit shortly.",
    };

  } catch (err) {
    console.error('bookAppointment → Error:'.red, err.message);
    return {
      success: false,
      message: "There was a connection issue on my end. Our agent will follow up to confirm your visit.",
    };
  }
};

module.exports = bookAppointment;
