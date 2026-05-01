/**
 * whatsapp-bridge/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * WhatsApp Bridge — Uses YOUR phone's WhatsApp via whatsapp-web.js
 * No Meta API. No tokens. No monthly fees.
 * Just scan QR once → sends messages from your own number forever.
 *
 * Run this in Termux on your Android phone:
 *   npm install
 *   node server.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express     = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode      = require('qrcode-terminal');
const qrcodeImg   = require('qrcode');
const fs          = require('fs');

const app  = express();
app.use(express.json());

const PORT = process.env.WA_BRIDGE_PORT || 3001;

// ── STATE ─────────────────────────────────────────────────────────────────────
let waReady   = false;
let lastQR    = null;
let qrDataUrl = null;

// ── WHATSAPP CLIENT ───────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'propedge' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--single-process',
    ],
  },
});

client.on('qr', async (qr) => {
  lastQR = qr;
  console.log('\n📱 SCAN THIS QR CODE WITH YOUR WHATSAPP:\n');
  qrcode.generate(qr, { small: true });

  // Also save as image for easy scanning from phone
  try {
    qrDataUrl = await qrcodeImg.toDataURL(qr);
    console.log('\n✅ QR also available at: http://localhost:' + PORT + '/qr\n');
  } catch (e) {}
});

client.on('ready', () => {
  waReady = true;
  lastQR  = null;
  console.log('\n✅ WhatsApp connected! Your number is now the sender.\n');
  console.log('🚀 Bridge running at http://localhost:' + PORT);
});

client.on('disconnected', (reason) => {
  waReady = false;
  console.log('❌ WhatsApp disconnected:', reason);
  console.log('Reconnecting in 5 seconds...');
  setTimeout(() => client.initialize(), 5000);
});

client.on('auth_failure', () => {
  waReady = false;
  console.log('❌ Auth failed — delete .wwebjs_auth folder and scan QR again');
});

// ── HELPER — format phone to WhatsApp ID ─────────────────────────────────────
function toWAId(phone) {
  // Remove everything except digits
  const digits = String(phone).replace(/\D/g, '');
  return digits + '@c.us';
}

// ── ROUTE — GET /status ───────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    ready:     waReady,
    qr_needed: !waReady && !!lastQR,
    message:   waReady
      ? 'WhatsApp connected — ready to send'
      : lastQR
        ? 'Scan QR at /qr to connect'
        : 'Initializing...',
  });
});

// ── ROUTE — GET /qr — Show QR code as image ──────────────────────────────────
app.get('/qr', (req, res) => {
  if (waReady) {
    return res.send('<h2 style="color:green;font-family:sans-serif">✅ WhatsApp is connected! No QR needed.</h2>');
  }
  if (!qrDataUrl) {
    return res.send('<h2 style="font-family:sans-serif">⏳ Generating QR... refresh in 5 seconds.</h2><script>setTimeout(()=>location.reload(),5000)</script>');
  }
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PropEdge WhatsApp QR</title>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        body { font-family: sans-serif; text-align: center; background: #0f0f1a; color: #fff; padding: 30px; }
        img  { border: 8px solid #fff; border-radius: 16px; max-width: 280px; }
        h2   { color: #f0c040; }
        p    { color: #aaa; font-size: 13px; }
      </style>
    </head>
    <body>
      <h2>🏠 PropEdge WhatsApp Bridge</h2>
      <p>Open WhatsApp → Linked Devices → Link a Device → Scan this QR</p>
      <img src="${qrDataUrl}" alt="QR Code">
      <p>This page refreshes automatically every 10 seconds.</p>
      <script>setTimeout(() => location.reload(), 10000);</script>
    </body>
    </html>
  `);
});

// ── ROUTE — POST /send — Send a WhatsApp message ─────────────────────────────
app.post('/send', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'to and message are required' });
  }

  if (!waReady) {
    console.log(`[WhatsApp-OFFLINE] To: ${to}\n${message}\n`);
    return res.json({
      success:   false,
      simulated: true,
      error:     'WhatsApp not connected — scan QR at /qr',
    });
  }

  try {
    const waId  = toWAId(to);
    const sent  = await client.sendMessage(waId, message);
    console.log(`✅ WhatsApp sent to ${to}`);
    res.json({ success: true, messageId: sent.id._serialized });
  } catch (err) {
    console.error(`❌ WhatsApp send error to ${to}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── ROUTE — POST /send-bulk — Send to multiple numbers ───────────────────────
app.post('/send-bulk', async (req, res) => {
  const { recipients, message } = req.body;

  if (!Array.isArray(recipients) || !message) {
    return res.status(400).json({ success: false, error: 'recipients (array) and message required' });
  }

  const results = [];
  for (const phone of recipients) {
    try {
      if (!waReady) {
        results.push({ phone, success: false, error: 'not connected' });
        continue;
      }
      await client.sendMessage(toWAId(phone), message);
      results.push({ phone, success: true });
      // Small delay to avoid spam detection
      await new Promise(r => setTimeout(r, 1200));
    } catch (e) {
      results.push({ phone, success: false, error: e.message });
    }
  }

  const sent   = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`📊 Bulk send: ${sent} sent, ${failed} failed`);
  res.json({ success: true, sent, failed, results });
});

// ── START ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🏠 PropEdge WhatsApp Bridge starting...');
  console.log(`📡 API: http://localhost:${PORT}`);
  console.log('⏳ Initializing WhatsApp client...\n');
  client.initialize();
});

module.exports = app;
