require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const fetch = require('node-fetch');

const { GptService }           = require('./services/gpt-service');
const { StreamService }        = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService }  = require('./services/tts-service');
const { setLeadContext, clearLeadContext, getRetryCount, incrementRetry, clearRetry } = require('./services/call-context');

const app        = express();
const wsInstance = ExpressWs(app);
app.use(express.json());

const PORT        = process.env.PORT        || 3000;
const BACKEND_URL = process.env.PROPEDGE_BACKEND_URL || 'https://real-estate-web-liard-rho.vercel.app';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory transcript builder per call
// ─────────────────────────────────────────────────────────────────────────────
const callTranscripts = new Map(); // sessionId → string[]

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE WebSocket connection
// ─────────────────────────────────────────────────────────────────────────────
let mobileClient = null;

function notifyMobileLead(lead) {
  if (mobileClient && mobileClient.readyState === 1) {
    mobileClient.send(JSON.stringify({ event: 'incoming-lead', lead }));
    console.log(`📱 Mobile notified: ${lead.name}`.green);
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — Save call log to Vercel backend
// ─────────────────────────────────────────────────────────────────────────────
async function saveCallLogToBackend({ lead, status, duration, transcript }) {
  try {
    await fetch(`${BACKEND_URL}/api/call-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId:    lead?.id        || null,
        agentId:   lead?.agent_id  || null,
        teamId:    lead?.team_id   || null,
        phone:     lead?.phone     || null,
        duration,
        transcript: transcript.join('\n'),
        status,    // 'answered' | 'no_answer' | 'failed'
      }),
    });
    console.log(`📝 Call log saved: ${status}`.cyan);
  } catch (err) {
    console.error('Call log save error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — Mobile WebSocket (audio + signals)
// ─────────────────────────────────────────────────────────────────────────────
app.ws('/connection', (ws) => {
  console.log('📱 Mobile App connected'.green);
  mobileClient = ws;

  const gptService           = new GptService();
  const streamService        = new StreamService(ws);
  const transcriptionService = new TranscriptionService();
  const ttsService           = new TextToSpeechService({});

  let interactionCount = 0;
  let callStartTime    = Date.now();
  let currentLead      = null;
  let sessionId        = null;

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    if (msg.event === 'start') {
      currentLead   = msg.lead || { name: 'Valued Buyer' };
      sessionId     = msg.sessionId || `mobile_${Date.now()}`;
      callStartTime = Date.now();
      callTranscripts.set(sessionId, []);

      // Store lead context so bookAppointment can access it
      setLeadContext(sessionId, currentLead);

      // Inject lead + assigned agent into AI
      gptService.setSessionId(sessionId);
      gptService.setLeadInfo({
        name:              currentLead.name,
        propertyInterest:  currentLead.property_interest,
        assignedAgentName: currentLead.assigned_agent_name,
        isReminder:        currentLead.isReminder || false,
      });

      const openingLine = `Hi${currentLead.name ? ` ${currentLead.name}` : ''}! This is Aria from ${process.env.COMPANY_NAME || 'Dream Homes'}. You recently checked out a property on our website — is now a good time for a quick chat?`;

      callTranscripts.get(sessionId).push(`Aria: ${openingLine}`);
      ttsService.generate({ partialResponseIndex: null, partialResponse: openingLine }, 0);
      console.log(`🎙️  Call started for ${currentLead.name}`.cyan);

    } else if (msg.event === 'media') {
      transcriptionService.send(msg.payload);

    } else if (msg.event === 'stop') {
      const duration = Math.round((Date.now() - callStartTime) / 1000);
      const transcript = callTranscripts.get(sessionId) || [];
      saveCallLogToBackend({ lead: currentLead, status: 'answered', duration, transcript });
      clearLeadContext(sessionId);
      callTranscripts.delete(sessionId);
      console.log(`📵 Call ended. Duration: ${duration}s`.yellow);
    }
  });

  transcriptionService.on('transcription', async (text) => {
    if (!text) return;
    console.log(`Lead → GPT: ${text}`.yellow);
    if (sessionId) callTranscripts.get(sessionId)?.push(`Lead: ${text}`);
    gptService.completion(text, interactionCount);
    interactionCount++;
  });

  gptService.on('gptreply', async (reply, icount) => {
    if (sessionId) callTranscripts.get(sessionId)?.push(`Aria: ${reply.partialResponse}`);
    ttsService.generate(reply, icount);
  });

  ttsService.on('speech', (responseIndex, audio, label, icount) => {
    streamService.buffer(responseIndex, audio);
  });

  ws.on('close', () => {
    console.log('📱 Mobile disconnected'.yellow);
    mobileClient = null;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — POST /outbound-call (Called by Vercel when new lead arrives)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/outbound-call', async (req, res) => {
  const { lead } = req.body;
  if (!lead?.phone) return res.status(400).json({ error: 'phone required' });

  console.log(`\n🔔 OUTBOUND CALL REQUEST: ${lead.name} (${lead.phone})`.bgGreen);

  // Notify mobile app — it will dial from SIM
  const mobileSent = notifyMobileLead(lead);

  if (!mobileSent) {
    console.log('⚠️  No mobile app connected — call not made'.yellow);
    return res.json({ success: false, message: 'No mobile app connected' });
  }

  res.json({ success: true, answered: false, message: 'Mobile app notified — call dialing' });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — POST /outbound-reminder (Visit reminder calls)
// ─────────────────────────────────────────────────────────────────────────────
app.post('/outbound-reminder', async (req, res) => {
  const { visit } = req.body;
  if (!visit) return res.status(400).json({ error: 'visit required' });

  const lead = {
    name:  visit.client_name,
    phone: visit.client_phone,
    property_interest: visit.property_name,
    isReminder: true,
  };

  const mobileSent = notifyMobileLead(lead);
  res.json({ success: mobileSent, message: mobileSent ? 'Reminder call sent to mobile' : 'No mobile connected' });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE — GET /health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:         'online',
    mobile_client:  mobileClient ? 'connected' : 'not connected',
    uptime_seconds: Math.round(process.uptime()),
  });
});

app.listen(PORT, () => {
  console.log(`\n🤖 Aria Voice Bridge running on port ${PORT}`.bgBlue);
  console.log(`📱 Waiting for mobile app connection...`.cyan);
});

module.exports = app;
