/**
 * AriaVoiceBridge.js — Full AI Call Bridge
 * ─────────────────────────────────────────
 * 1. Dials lead from your SIM
 * 2. Speaks with ElevenLabs human voice
 * 3. Listens with device mic
 * 4. Sends to Gemini AI (knows all your properties)
 * 5. AI auto-books visits + returns result
 * ─────────────────────────────────────────
 */

import Voice from '@react-native-voice/voice';
import { Linking, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';

// ── PASTE YOUR KEYS HERE ──────────────────────
const ELEVENLABS_API_KEY  = 'sk_9f8229f7d33ed25a0b1e54a33fe79ebd2363356901d336a9';
const ELEVENLABS_VOICE_ID = 'FGY2WhTYpPnrIDTdsKH5';
const USE_ELEVENLABS       = true; // false = free device TTS
// ─────────────────────────────────────────────

// Hard endings — call should terminate
const END_PHRASES = [
  'bye', 'goodbye', 'hang up', 'end call',
  'stop calling', 'dont call', "don't call"
];

// Soft endings — AI handles gracefully, does NOT terminate
// (handled by Gemini edge case rules in the prompt)
// not-interested, call-later, busy-now, no-thanks (handled by AI — not hard endings)

class AriaVoiceBridge {
  constructor() {
    this.backendUrl   = '';
    this.leadInfo     = {};
    this.sessionId    = '';
    this.isListening  = false;
    this.callState    = 'IDLE'; // IDLE | CALLING | SPEAKING | LISTENING | ENDED
    this.sound        = null;
    this.booking      = null;
    this._resolveCall = null;

    Voice.onSpeechResults = this._onSpeechResult.bind(this);
    Voice.onSpeechError   = (e) => { this.isListening = false; };
    Voice.onSpeechEnd     = ()  => { this.isListening = false; };
  }

  // ── Connect to Vercel ────────────────────────
  async connect(url) {
    this.backendUrl = url;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:     true,
      playsInSilentModeIOS:   true,
      shouldDuckAndroid:      true,
      playThroughEarpieceAndroid: false,
    });
    console.log('Bridge connected:', url);
  }

  // ── Main entry: new lead arrives ─────────────
  async triggerCallWithLead(lead) {
    this.leadInfo  = lead;
    this.sessionId = `${lead.phone}-${Date.now()}`;
    this.booking   = null;
    this.callState = 'CALLING';

    return new Promise(async (resolve) => {
      this._resolveCall = resolve;

      // Step 1: Dial the lead from SIM
      await this._dial(lead.phone);

      // Step 2: Wait 10 sec for call to connect
      await this._sleep(10000);

      // Step 3: Opening line
      const opening = `Hi ${lead.name || 'there'}! This is Sarah calling from Dream Homes Realty. You recently showed interest in one of our properties on our website. Is this a good time for a quick chat?`;
      await this._speak(opening);
    });
  }

  // ── Dial from SIM ────────────────────────────
  async _dial(phone) {
    if (!phone) return;
    const url = `tel:${phone.replace(/\s+/g, '')}`;
    const ok  = await Linking.canOpenURL(url);
    if (ok) {
      await Linking.openURL(url);
      console.log('Dialing:', phone);
    } else {
      Alert.alert('Error', `Cannot dial ${phone}`);
    }
  }

  // ── Speak text ───────────────────────────────
  async _speak(text) {
    this.callState = 'SPEAKING';
    console.log('Speaking:', text.substring(0, 60));

    try {
      if (USE_ELEVENLABS && ELEVENLABS_API_KEY !== 'PASTE_YOUR_ELEVENLABS_KEY_HERE') {
        await this._elevenLabsSpeak(text);
      } else {
        await this._deviceSpeak(text);
      }
    } catch (err) {
      console.error('Speak error:', err.message);
      await this._deviceSpeak(text);
    }
  }

  // ── ElevenLabs TTS ───────────────────────────
  async _elevenLabsSpeak(text) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key':   ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept':       'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.9, style: 0.4, use_speaker_boost: true },
        }),
      }
    );

    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);

    const path = `${FileSystem.cacheDirectory}priya.mp3`;
    const blob = await res.blob();

    await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = reader.result.split(',')[1];
        await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if (this.sound) await this.sound.unloadAsync();
    const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true, volume: 1.0 });
    this.sound = sound;

    await new Promise((resolve) => {
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.didJustFinish) { resolve(); this._startListening(); }
      });
    });
  }

  // ── Device TTS fallback ──────────────────────
  async _deviceSpeak(text) {
    const { default: Speech } = await import('expo-speech');
    await new Promise((resolve) => {
      Speech.speak(text, {
        language: 'en-IN', pitch: 1.05, rate: 0.87,
        onDone:  () => { resolve(); this._startListening(); },
        onError: () => { resolve(); this._startListening(); },
      });
    });
  }

  // ── Start listening ──────────────────────────
  async _startListening() {
    if (this.isListening || this.callState === 'ENDED') return;
    try {
      this.isListening = true;
      this.callState   = 'LISTENING';
      await Voice.start('en-US');
    } catch (e) {
      console.error('Mic error:', e);
      this.isListening = false;
    }
  }

  // ── When lead speaks ─────────────────────────
  async _onSpeechResult(e) {
    const text = e.value?.[0];
    if (!text) return;

    this.isListening = false;
    await Voice.stop();
    console.log('Lead said:', text);

    // Check if call should end
    if (END_PHRASES.some(p => text.toLowerCase().includes(p))) {
      await this._speak('Thank you so much for your time! It was lovely speaking with you. Have a wonderful day. Goodbye!');
      this._endCall();
      return;
    }

    // Send to Gemini AI on Vercel
    await this._getAIReply(text);
  }

  // ── Get AI reply from Vercel (Gemini) ────────
  async _getAIReply(input) {
    try {
      const res  = await fetch(`${this.backendUrl}/api/ai/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          state:     this.callState,
          lead:      this.leadInfo,
          sessionId: this.sessionId,
        }),
      });

      const data = await res.json();

      // Update lead info if AI extracted more details
      if (data.lead) this.leadInfo = { ...this.leadInfo, ...data.lead };

      // Check if AI booked a visit
      if (data.action === 'BOOKED' && data.booking) {
        this.booking = data.booking;
        console.log('✅ Visit booked!', data.booking);
      }

      if (data.reply) {
        await this._speak(data.reply);
      }

      // End call if booking done and AI says goodbye
      if (data.action === 'BOOKED' || data.nextState === 'END') {
        await this._sleep(3000);
        this._endCall();
      }

    } catch (err) {
      console.error('AI error:', err.message);
      await this._speak("I am sorry, I did not catch that. Could you repeat please?");
    }
  }

  // ── End call + resolve promise ───────────────
  _endCall() {
    this.callState = 'ENDED';
    console.log('Call ended.');
    if (this._resolveCall) {
      this._resolveCall({ success: true, booking: this.booking, lead: this.leadInfo });
      this._resolveCall = null;
    }
  }

  // ── Stop everything ──────────────────────────
  async stop() {
    this.callState = 'ENDED';
    try {
      const { default: Speech } = await import('expo-speech');
      Speech.stop();
      await Voice.destroy();
      Voice.removeAllListeners();
      if (this.sound) await this.sound.unloadAsync();
    } catch (e) {}
    this.isListening = false;
    if (this._resolveCall) {
      this._resolveCall({ success: false, booking: null });
      this._resolveCall = null;
    }
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

export default new AriaVoiceBridge();
