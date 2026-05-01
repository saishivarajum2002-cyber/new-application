// function-manifest.js
// ─────────────────────────────────────────────────────────────────────────────
// AI tool definitions — no Twilio, uses sessionId instead of callSid
// ─────────────────────────────────────────────────────────────────────────────

const tools = [

  // ── 1. getProperty ──────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'getProperty',
      say: "I'll check that for you — just one moment.",
      description: `Fetch live property listings matching the lead's preferences.
Call this ONLY when the lead asks about price, location, availability, or features.
NEVER invent property data.`,
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City or area the lead wants. E.g. "Koramangala", "Dubai Marina".',
          },
          budget: {
            type: 'string',
            description: 'Budget in natural language. E.g. "50 lakhs", "1 crore", "AED 2 million".',
          },
          property_type: {
            type: 'string',
            enum: ['apartment', 'villa', 'studio', 'plot', 'commercial', 'townhouse'],
            description: 'Type of property the lead wants.',
          },
        },
        required: [],
      },
    },
  },

  // ── 2. bookAppointment ──────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'bookAppointment',
      say: "Perfect — give me just a second to lock that in for you.",
      description: `Book a property visit for the lead.
Call ONLY after the lead agrees on a specific date AND time.
Always confirm: "So that's [date] at [time] — shall I confirm?" before calling this.`,
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Current session ID. Auto-injected by GptService.',
          },
          visit_date: {
            type: 'string',
            description: 'ISO date string. E.g. "2026-05-10".',
          },
          visit_time: {
            type: 'string',
            description: 'Time of visit. E.g. "11:00 AM" or "14:30".',
          },
          property_interest: {
            type: 'string',
            description: 'Property name or type the lead wants to visit.',
          },
        },
        required: ['visit_date', 'visit_time'],
      },
    },
  },

  // ── 3. transfer_call ────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'transfer_call',
      say: "Got it — I'll alert our senior agent right away. One moment.",
      description: `Notify a human agent to call the lead back.
Trigger ONLY when:
  (a) lead explicitly asks for a human agent,
  (b) lead asks complex legal/financial questions more than once, or
  (c) lead signals very high buying intent and wants immediate action.`,
      parameters: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Current session ID. Auto-injected by GptService.',
          },
          reason: {
            type: 'string',
            enum: ['user_requested', 'complex_question', 'high_intent'],
            description: 'Why the call is being escalated.',
          },
        },
        required: ['sessionId'],
      },
    },
  },

];

module.exports = tools;
