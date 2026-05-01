/**
 * services/whatsapp.js — PropEdge WhatsApp Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends WhatsApp messages via your OWN phone number.
 * No Meta API. No WHATSAPP_TOKEN. No WHATSAPP_PHONE_ID needed.
 *
 * How it works:
 *   1. whatsapp-bridge/server.js runs on your Android phone (Termux)
 *   2. You scan QR once with your WhatsApp
 *   3. This service calls the bridge API to send messages
 *   4. Messages appear to come from YOUR personal WhatsApp number
 *
 * Required env var:
 *   WA_BRIDGE_URL = http://your-phone-ip:3001
 *   (or ngrok URL if accessing remotely)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const WA_BRIDGE_URL = process.env.WA_BRIDGE_URL || null;
const AGENT_NAME    = process.env.AGENT_NAME    || 'PropEdge Team';
const VERCEL_URL    = process.env.BASE_URL       || 'https://real-estate-web-liard-rho.vercel.app';

/**
 * Normalize phone to E.164 digits only (no +)
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[\s\-().]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('+')) p = p.slice(1);
  if (/^[1-9]\d{6,14}$/.test(p)) return p;
  return null;
}

/**
 * Core send — calls the WhatsApp bridge running on your phone
 */
async function sendWhatsAppText(to, text) {
  const phone = normalizePhone(to);
  if (!phone) {
    console.warn(`⚠️  WhatsApp: Invalid phone "${to}"`);
    return { success: false, error: 'Invalid phone number' };
  }

  // If bridge not configured → log and return graceful success
  if (!WA_BRIDGE_URL) {
    console.log(`📱 [WhatsApp-SIMULATION] To: +${phone}\n${text}\n`);
    console.log('   → Set WA_BRIDGE_URL env var to enable real sending');
    return { success: true, simulated: true };
  }

  try {
    const { default: fetch } = await import('node-fetch');
    const res = await fetch(`${WA_BRIDGE_URL}/send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message: text }),
      signal: AbortSignal.timeout(12000),
    });

    const data = await res.json();

    if (data.success) {
      console.log(`✅ WhatsApp sent to +${phone}`);
    } else if (data.simulated) {
      console.log(`📱 [WhatsApp-OFFLINE] To: +${phone} — Bridge not connected yet`);
    } else {
      console.error(`❌ WhatsApp failed to +${phone}: ${data.error}`);
    }
    return data;
  } catch (err) {
    console.error(`❌ WhatsApp bridge error for +${phone}:`, err.message);
    // Non-blocking — don't break the main flow
    return { success: false, error: err.message };
  }
}

// ── MESSAGE TEMPLATES ─────────────────────────────────────────────────────────

async function sendBookingCreatedMsg(clientPhone, visit) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((visit.property_name || '') + ' India')}`;
  const msg =
`🏠 *${AGENT_NAME}*

Hi ${visit.client_name || 'there'},

✅ Your property visit is *CONFIRMED!*

📌 *Property:* ${visit.property_name || 'N/A'}
📅 *Date:* ${visit.visit_date || 'N/A'}
🕒 *Time:* ${visit.visit_time || 'N/A'}
✅ *Status:* Confirmed

📍 *Location:* ${maps}

We look forward to seeing you! Reply here if you need to reschedule.

_PropEdge Real Estate_`;
  return sendWhatsAppText(clientPhone, msg);
}

async function sendBookingConfirmedMsg(clientPhone, visit) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((visit.property_name || '') + ' India')}`;
  const msg =
`🏠 *${AGENT_NAME}*

Hi ${visit.client_name || 'there'},

🎉 Your property visit has been *CONFIRMED!*

📌 *Property:* ${visit.property_name || 'N/A'}
📅 *Date:* ${visit.visit_date || 'N/A'}
🕒 *Time:* ${visit.visit_time || 'N/A'}
✅ *Status:* Confirmed

📍 *Location:* ${maps}

👤 *Your Agent:* ${process.env.AGENT_NAME || 'Your Agent'}
📞 *Agent Phone:* ${process.env.AGENT_PHONE || 'N/A'}

We look forward to seeing you! 🔑

_PropEdge Real Estate_`;
  return sendWhatsAppText(clientPhone, msg);
}

async function sendVisitReminderMsg(clientPhone, visit) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((visit.property_name || '') + ' India')}`;
  const msg =
`🏠 *${AGENT_NAME} — Reminder*

Hi ${visit.client_name || 'there'},

⏰ Your property visit is *tomorrow!*

📌 *Property:* ${visit.property_name || 'N/A'}
📅 *Date:* ${visit.visit_date || 'N/A'}
🕒 *Time:* ${visit.visit_time || 'N/A'}

📍 *Google Maps:* ${maps}

Please arrive 5 minutes early. See you soon! 🙌

_PropEdge Real Estate_`;
  return sendWhatsAppText(clientPhone, msg);
}

async function sendNewLeadNotification(agentPhone, lead) {
  const msg =
`⚡ *New Lead Alert — ${AGENT_NAME}*

A new buyer just submitted a query!

👤 *Name:* ${lead.name || 'N/A'}
📞 *Phone:* ${lead.phone || 'N/A'}
📧 *Email:* ${lead.email || 'N/A'}
🏠 *Interest:* ${lead.property_interest || 'Not specified'}
💰 *Budget:* ${lead.budget || 'Not specified'}

🤖 AI agent is calling them right now...

🔗 Dashboard: ${VERCEL_URL}/propedge_dashboard.html

_PropEdge CRM_`;
  return sendWhatsAppText(agentPhone, msg);
}

async function sendAICallLink(clientPhone, lead) {
  const msg =
`🏠 *${AGENT_NAME}*

Hi ${lead.name || 'there'},

I'm *Aria*, your AI property specialist from ${AGENT_NAME}.

I saw your interest in ${lead.property_interest || 'our properties'} and I'm reaching out to help you find your perfect home!

I'll be calling you shortly. Feel free to reply here with any questions in the meantime. 😊

_Aria @ PropEdge Real Estate_`;
  return sendWhatsAppText(clientPhone, msg);
}

module.exports = {
  sendWhatsAppText,
  sendBookingCreatedMsg,
  sendBookingConfirmedMsg,
  sendVisitReminderMsg,
  sendNewLeadNotification,
  sendAICallLink,
};
