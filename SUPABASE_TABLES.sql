-- ============================================================
-- Run this in your Supabase SQL editor to create all tables
-- ============================================================

-- ── TEAM AGENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_agents (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id          TEXT NOT NULL,           -- owner agent email
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  coverage_areas   TEXT[] DEFAULT '{}',     -- ["Whitefield","Indiranagar"]
  status           TEXT DEFAULT 'active',   -- active | inactive
  leads_assigned   INT  DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── TEAM LEADS (with pipeline stage) ──────────────────────────
CREATE TABLE IF NOT EXISTS team_leads (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id            TEXT,
  agent_id           UUID REFERENCES team_agents(id),
  name               TEXT,
  phone              TEXT,
  email              TEXT,
  property_interest  TEXT,
  budget             TEXT,
  source             TEXT DEFAULT 'Website',
  stage              TEXT DEFAULT 'new',
  -- Pipeline stages: new → contacted → qualified → booked → visited → closed → lost
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ── CALL LOGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id        UUID,
  agent_id       UUID,
  team_id        TEXT,
  phone          TEXT,
  status         TEXT,    -- answered | no_answer | failed
  duration_sec   INT  DEFAULT 0,
  transcript     TEXT DEFAULT '',
  recording_url  TEXT,
  called_at      TIMESTAMPTZ DEFAULT now()
);

-- ── ADD INDEXES for fast queries ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_team_leads_team_id   ON team_leads(team_id);
CREATE INDEX IF NOT EXISTS idx_team_leads_agent_id  ON team_leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_team_leads_stage     ON team_leads(stage);
CREATE INDEX IF NOT EXISTS idx_call_logs_team_id    ON call_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_called_at  ON call_logs(called_at DESC);
