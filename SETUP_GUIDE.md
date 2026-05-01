# PropEdge AI Agent — Complete Team Setup Guide v3.0

## WHAT THIS SYSTEM DOES NOW

```
Lead fills form
      ↓
Vercel saves lead + assigns to best agent (auto)
      ↓
Phone app detects lead in 5 seconds
      ↓
AI dials from YOUR SIM
      ↓
AI knows ALL your properties (live sync)
      ↓
AI talks, qualifies, books visit
      ↓
Booking saved to Supabase + agent notified
      ↓
Call log + transcript saved
      ↓
If no answer → retries in 5 min, 15 min, 30 min
      ↓
Full report: leads, calls, bookings, conversion %
```

---

## STEP 1 — Create Supabase Tables

1. Go to supabase.com → your project → SQL Editor
2. Open the file: SUPABASE_TABLES.sql
3. Paste and run it
4. That creates: team_agents, team_leads, call_logs

---

## STEP 2 — Set Vercel Environment Variables

| Variable            | Value                         | Where to get          |
|--------------------|-------------------------------|------------------------|
| MONGODB_URI        | mongodb+srv://...             | mongodb.com/atlas      |
| GEMINI_API_KEY     | AIzaSy...                     | aistudio.google.com    |
| SUPABASE_URL       | https://xxx.supabase.co       | supabase.com           |
| SUPABASE_ANON_KEY  | eyJ...                        | supabase.com           |
| RESEND_API_KEY     | re_...                        | resend.com             |
| AGENT_EMAIL        | your@email.com                | Your email             |
| AGENT_NAME         | Your Name                     | —                      |
| BASE_URL           | https://your-app.vercel.app   | Your Vercel URL        |
| API_SECRET         | any-random-string             | Make one up            |
| TRANSFER_NUMBER    | +91XXXXXXXXXX                 | Your agent's phone     |
| COMPANY_NAME       | Dream Homes Realty            | Your company name      |

---

## STEP 3 — Add Agents to Your Team

Use this API call to add agents:

POST https://your-app.vercel.app/api/team/agents
Headers: x-api-secret: your-secret
Body:
{
  "name": "Rahul Sharma",
  "email": "rahul@dreamhomes.com",
  "phone": "+919876543210",
  "coverage_areas": ["Whitefield", "Koramangala"],
  "teamId": "your@email.com"
}

Leads from those areas will auto-assign to this agent.

---

## STEP 4 — Setup Mobile App

1. Install Expo Go from Play Store
2. cd mobile-app && npm install
3. Update App.js: BACKEND_URL = your Vercel URL
4. Update AriaVoiceBridge.js: paste ElevenLabs keys
5. npx expo start → scan QR with Expo Go
6. Tap Activate Agent

---

## STEP 5 — View Reports

GET https://your-app.vercel.app/api/report?teamId=your@email.com
Headers: x-api-secret: your-secret

Returns:
- Total leads, calls made, answer rate
- Bookings + conversion %
- Per-agent breakdown
- Pipeline (new/contacted/qualified/booked/visited/closed/lost)

---

## HOW LEAD ROUTING WORKS

```
Lead comes in from form
      ↓
System checks lead location/interest
      ↓
Matches to agent with that coverage area
      ↓
If no match → assigns to least-busy agent
      ↓
AI calls as that agent's team
"I'll make sure Rahul is ready for you"
      ↓
Booking goes to that agent
      ↓
Agent gets WhatsApp alert
```

---

## HOW RETRY WORKS

```
AI calls lead
      ↓
No answer?
      ↓
Retry in 5 minutes
      ↓
Still no answer?
      ↓
Retry in 15 minutes
      ↓
Still no answer?
      ↓
Retry in 30 minutes
      ↓
3 attempts = stop + log as "no_answer"
```

---

## FILES CHANGED FROM ORIGINAL

1. api/index.js                          — Team routes, retry, reporting, pipeline
2. ai voice agent calls/app.js           — Call logging, transcript, agent context
3. ai voice agent calls/services/gpt-service.js — Agent branding in AI voice
4. ai voice agent calls/functions/ (cleaned)    — Removed duplicates
5. services/team.js                      — NEW: Multi-agent routing + reporting
6. services/retry.js                     — NEW: Retry system
7. mobile-app/App.js                     — 3-tab dashboard
8. mobile-app/AriaVoiceBridge.js         — ElevenLabs + booking
9. SUPABASE_TABLES.sql                   — NEW: Run this in Supabase

---

## API ENDPOINTS REFERENCE

| Method | Endpoint                   | What it does                     |
|--------|---------------------------|----------------------------------|
| POST   | /api/leads                | Submit lead + trigger AI call    |
| PATCH  | /api/leads/:id/stage      | Move lead in pipeline            |
| POST   | /api/leads/:id/takeover   | Agent manual override            |
| GET    | /api/team/agents          | List all agents                  |
| POST   | /api/team/agents          | Add new agent                    |
| POST   | /api/team/lead-assign     | Assign lead to agent             |
| POST   | /api/call-log             | Save call result + transcript    |
| GET    | /api/call-logs            | Get call history                 |
| GET    | /api/report               | Full team performance report     |
| GET    | /api/retry-status?phone=  | Check retry queue for a phone    |
