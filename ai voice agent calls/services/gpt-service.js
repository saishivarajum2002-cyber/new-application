require('dotenv').config();
require('colors');

const EventEmitter = require('events');
const OpenAI = require('openai');
const tools = require('../functions/function-manifest');

// Dynamically load all available function handlers
const availableFunctions = {};
tools.forEach((tool) => {
  const name = tool.function.name;
  availableFunctions[name] = require(`../functions/${name}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Aria, Real Estate Voice Agent
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt(leadName, isReminder, propertyInterest, assignedAgentName) {
  const company   = process.env.COMPANY_NAME || 'our agency';
  const agentRef  = assignedAgentName ? ` I'll make sure ${assignedAgentName} is ready to show you the property personally.` : '';

  if (isReminder) {
    return `You are Aria, a friendly assistant from ${company}.
Your ONLY job on this call is to remind the lead about their upcoming property visit.

Say: "Hi${leadName ? ` ${leadName}` : ''}, just a quick reminder about your property visit today. 
The location has been sent to your WhatsApp. Looking forward to seeing you there!"

After the reminder message:
- Answer any quick question (max 1 sentence).
- End the call politely within 60 seconds.
- Do NOT re-qualify or ask new questions.
`;
  }

  return `You are Aria, a warm, professional, and slightly witty real estate advisor at ${company}. 
Your tone is conversational, never robotic. You sound like a helpful friend who knows the market.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE MISSION: QUALIFY & BOOK VISIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your goal is to guide the lead through the 4-step script. 
If they go off-topic, ACKNOWLEDGE then PIVOT back.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES FOR REALISM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ACKNOWLEDGE & PIVOT: If the user talks about anything else (weather, work, life), respond with a bridging phrase.
   Examples: 
   - "I hear you, sounds like a busy day! Speaking of busy, when are you actually planning to move?"
   - "That's a great point. And just so I can help you better, what's your rough budget?"
   - "Honestly, I get that. To narrow down the search though, are you looking for a villa or apartment?"

2. ONE AT A TIME: Only ask ONE question per turn. Never stack questions.

3. KNOWLEDGE FIRST: If they ask about a property, call getProperty(). 
   - DO NOT make up prices or sizes. 
   - If getProperty() says "not found", say: "I don't have that exact one in my list yet, but let me check our off-market options. By the way, what budget are we working with?"

4. TRANSFER SIGNALS: Call transfer_call() immediately if:
   - User says "I want to talk to a human/agent/person."
   - User asks complex legal, tax, or mortgage questions that you don't know.
   - User sounds frustrated or very high-intent (e.g., "I want to buy this today, where do I sign?").

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR 4-STEP SCRIPT (FOLLOW IN ORDER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: Ask "Are you looking to buy for yourself or is this an investment?"
STEP 2: Ask "What type of property — apartment, villa, or something else?"
STEP 3: Ask "What's your rough budget range?"
STEP 4: Ask "Are you planning to move soon or just exploring?"

FINAL GOAL: "Honestly, the best way is to see it in person. When are you free this week for a visit?"

BOOKING FLOW:
Acknowledge interest → Ask "Weekday or weekend?" → Ask "Morning or afternoon?" → Confirm slot → call bookAppointment().

CONTRACTIONS: Use "we're", "you're", "I'll", "it's". Sound natural!
${propertyInterest ? `- The lead is interested in: ${propertyInterest}. Mention this naturally.` : ''}
`;
}

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
    this.userContext = [];
    this.partialResponseIndex = 0;
    this.sessionId = null;
    this._systemPromptBuilt = false;
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Inject lead context (name, property interest) into the system prompt.
   * Called from app.js after the stream starts and we know the sessionId.
   */
  setLeadInfo({ name, propertyInterest, isReminder, assignedAgentName } = {}) {
    const systemPrompt = buildSystemPrompt(name, isReminder, propertyInterest, assignedAgentName);
    this.userContext = [{ role: 'system', content: systemPrompt }];
    this._systemPromptBuilt = true;
  }

  /** Fallback — build generic prompt if setLeadInfo was never called */
  _ensureSystemPrompt() {
    if (!this._systemPromptBuilt) {
      this.userContext = [{ role: 'system', content: buildSystemPrompt(null, false, null) }];
      this._systemPromptBuilt = true;
    }
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ role, name, content: text });
    } else {
      this.userContext.push({ role, content: text });
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    this._ensureSystemPrompt();

    if (role !== 'function') {
      this.updateUserContext(name, role, text);
    }

    // ⚡ FAST-TRACK: Instant response for simple script answers to remove latency
    const lowerText = text.toLowerCase().trim();
    const fastResponses = {
      'yes':        "Great! Just to understand you better — are you looking to buy for yourself or as an investment?",
      'no':         "No problem at all. Are you generally exploring, or do you have a specific property type in mind?",
      'villa':      "A villa is a great choice. What's your rough budget range for that?",
      'apartment':  "Apartments are very popular right now. What's your rough budget range?",
      'investment': "Smart thinking. What type of property are you considering — apartment or villa?",
      'myself':     "Got it. What type of property are you looking for your new home?",
      'sure':       "Excellent! Would weekdays or weekends work better for the visit?",
      'okay':       "Perfect. Would weekdays or weekends work better for you?",
    };

    if (fastResponses[lowerText]) {
      console.log(`Aria → Fast-track: "${lowerText}"`.green);
      const response = fastResponses[lowerText];
      this.emit('gptreply', { partialResponseIndex: this.partialResponseIndex, partialResponse: response }, interactionCount);
      this.partialResponseIndex++;
      this.updateUserContext('assistant', 'assistant', response);
      return;
    }

    try {
      const stream = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: this.userContext,
        tools,
        stream: true,
      });

      let completeResponse = '';
      let partialResponse  = '';
      let functionName     = '';
      let functionArgs     = '';
      let isFunctionCall   = false;

      for await (const chunk of stream) {
        const delta       = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (delta?.tool_calls?.length > 0) {
          isFunctionCall = true;
          const toolCall = delta.tool_calls[0];
          if (toolCall.function?.name)      functionName  = toolCall.function.name;
          if (toolCall.function?.arguments) functionArgs += toolCall.function.arguments;
        } else if (delta?.content) {
          completeResponse += delta.content;
          partialResponse  += delta.content;
          // Emit when we hit a sentence boundary for low-latency TTS
          if (partialResponse.match(/[.!?]\s*$/)) {
            this.emit('gptreply', {
              partialResponseIndex: this.partialResponseIndex,
              partialResponse: partialResponse.trim(),
            }, interactionCount);
            this.partialResponseIndex++;
            partialResponse = '';
          }
        }

        if (finishReason === 'tool_calls') {
          let parsedArgs = {};
          try { parsedArgs = JSON.parse(functionArgs); } catch (e) { parsedArgs = {}; }

          // Auto-inject sessionId for functions that need it
          if (['transfer_call', 'bookAppointment'].includes(functionName)) {
            parsedArgs.sessionId = this.sessionId;
          }

          // Speak the "say" string aloud immediately while function runs
          const toolDef = tools.find(t => t.function.name === functionName);
          if (toolDef?.function?.say) {
            this.emit('gptreply', {
              partialResponseIndex: this.partialResponseIndex,
              partialResponse: toolDef.function.say,
            }, interactionCount);
            this.partialResponseIndex++;
          }

          console.log(`Aria → Calling function: ${functionName}`.magenta);
          const handler = availableFunctions[functionName];
          const result  = await handler(parsedArgs);

          const toolCallId = `call_${Date.now()}`;
          this.userContext.push({
            role: 'assistant',
            tool_calls: [{ id: toolCallId, type: 'function', function: { name: functionName, arguments: functionArgs } }],
          });
          this.userContext.push({
            role: 'tool',
            tool_call_id: toolCallId,
            content: JSON.stringify(result),
          });

          await this.completion(JSON.stringify(result), interactionCount, 'function', functionName);
          return;
        }
      }

      // Emit any remaining partial response
      if (partialResponse.trim()) {
        this.emit('gptreply', {
          partialResponseIndex: this.partialResponseIndex,
          partialResponse: partialResponse.trim(),
        }, interactionCount);
        this.partialResponseIndex++;
      }

      if (!isFunctionCall) {
        this.updateUserContext('assistant', 'assistant', completeResponse);
      }

    } catch (err) {
      console.error('Aria → GPT Error:'.red, err.message);
      this.emit('gptreply', {
        partialResponseIndex: this.partialResponseIndex,
        partialResponse: "I'm having a connection issue. Let me ask — are you looking for something to live in, or more of an investment?",
      }, interactionCount);
      this.partialResponseIndex++;
    }
  }
}

module.exports = { GptService };
