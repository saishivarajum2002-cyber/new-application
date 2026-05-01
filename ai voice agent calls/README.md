# PropEdge AI Voice Bridge

Real estate AI voice agent — SIM-based calling using your own phone number.

## How It Works

```
Vercel backend receives new lead
        ↓
POST /outbound-call fired to this bridge
        ↓
Bridge notifies mobile app via WebSocket
        ↓
Mobile app dials lead from your real SIM
        ↓
AI (Aria) speaks using ElevenLabs voice
        ↓
Lead responds → Deepgram STT → text
        ↓
OpenAI processes → AI replies
        ↓
Booking saved to Supabase via /api/visits
```

## Prerequisites

Sign up for these free services:

- [Deepgram](https://console.deepgram.com/signup) — Speech to Text + TTS
- [OpenAI](https://platform.openai.com/signup) — AI brain
- [ElevenLabs](https://elevenlabs.io) — Natural human voice (optional upgrade)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 3. Start the bridge server

```bash
npm run dev     # development with auto-reload
npm start       # production
```

### 4. Connect your mobile app

Open the PropEdge mobile app → tap **Activate Agent**

The app connects to this bridge via WebSocket on port 3000.
When a new lead arrives, the bridge sends it to your phone and it auto-dials.

## Environment Variables

| Variable | Description |
|----------|-------------|
| OPENAI_API_KEY | OpenAI API key |
| DEEPGRAM_API_KEY | Deepgram API key |
| PROPEDGE_BACKEND_URL | Your Vercel backend URL |
| AGENT_EMAIL | Your agent email |
| COMPANY_NAME | Your company name |
| TRANSFER_NUMBER | Phone number to notify on call transfer |
| VOICE_MODEL | Deepgram TTS voice model |

## AI Functions

The AI can call these tools during a conversation:

- **getProperty** — Fetches live property listings from your backend
- **bookAppointment** — Books a visit and saves it to Supabase
- **transfer_call** — Notifies a human agent via WhatsApp to call back

## Project Structure

```
app.js                  — Main WebSocket + HTTP server
services/
  gpt-service.js        — OpenAI conversation handler
  transcription-service.js — Deepgram STT
  tts-service.js        — Deepgram/ElevenLabs TTS
  stream-service.js     — Audio buffering
  recording-service.js  — Transcript builder
  call-context.js       — Session → lead context map
functions/
  getProperty.js        — Fetch properties from backend
  bookAppointment.js    — Save visit booking
  transfer_call.js      — Notify human agent
  function-manifest.js  — AI tool definitions
```

## Deployment

Deploy this bridge to any Node.js host (Railway, Render, Fly.io, or your own VPS).
Set `AI_VOICE_URL` in your Vercel environment to point to this deployed bridge URL.

```bash
AI_VOICE_URL=https://your-bridge.railway.app
```
