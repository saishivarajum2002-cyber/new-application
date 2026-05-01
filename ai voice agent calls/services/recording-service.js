// recording-service.js
// ─────────────────────────────────────────────────────────────────────────────
// Records the call transcript in memory and saves it to the backend.
// No Twilio — transcripts come from STT already running in app.js.
// ─────────────────────────────────────────────────────────────────────────────
require('colors');

class RecordingService {
  constructor() {
    this.lines    = [];   // ['Aria: Hello!', 'Lead: Hi there']
    this.startMs  = Date.now();
  }

  addLine(speaker, text) {
    this.lines.push(`${speaker}: ${text}`);
  }

  getTranscript() {
    return this.lines.join('\n');
  }

  getDurationSeconds() {
    return Math.round((Date.now() - this.startMs) / 1000);
  }

  reset() {
    this.lines   = [];
    this.startMs = Date.now();
  }
}

module.exports = { RecordingService };
