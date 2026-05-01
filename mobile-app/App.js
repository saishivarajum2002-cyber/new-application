/**
 * PropEdge AI Agent — Mobile App
 * ─────────────────────────────────────────────────
 * ONE app that does everything:
 *  • Polls Vercel for new leads every 5 seconds
 *  • Auto-dials lead from your SIM
 *  • AI (Sarah) talks using ElevenLabs voice
 *  • AI knows all your properties
 *  • AI books visits automatically
 *  • Shows live dashboard: Leads, Calls, Bookings
 * ─────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, ScrollView,
  Alert, Dimensions
} from 'react-native';
import AriaVoiceBridge from './AriaVoiceBridge';

// ── YOUR VERCEL URL ── UPDATE THIS ──────────────
const BACKEND_URL = 'https://real-estate-web-liard-rho.vercel.app';
// ────────────────────────────────────────────────

const { width } = Dimensions.get('window');

export default function App() {
  const [tab, setTab]                 = useState('home');
  const [isActive, setIsActive]       = useState(false);
  const [status, setStatus]           = useState('Agent is OFF');
  const [currentLead, setCurrentLead] = useState(null);
  const [isOnCall, setIsOnCall]       = useState(false);
  const [leads, setLeads]             = useState([]);
  const [bookings, setBookings]       = useState([]);
  const [stats, setStats]             = useState({ total: 0, called: 0, booked: 0, pending: 0 });
  const [waStatus, setWaStatus]       = useState('checking'); // checking | connected | disconnected
  const intervalRef = useRef(null);

  // ── Poll for leads when agent is ON ──────────
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(pollLeads, 5000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive]);

  const pollLeads = async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/api/mobile/poll-leads`);
      const data = await res.json();
      if (data?.lead) {
        console.log('🔔 New lead:', data.lead.name);
        startCallForLead(data.lead);
      }
    } catch (e) {
      console.log('Poll error:', e.message);
    }
  };

  // ── Handle a new lead ─────────────────────────
  const startCallForLead = async (lead) => {
    if (isOnCall) return; // Don't interrupt an active call

    setCurrentLead(lead);
    setIsOnCall(true);
    setStatus(`📞 Calling ${lead.name || lead.phone}...`);

    // Add to leads log
    const newEntry = {
      id:       Date.now(),
      name:     lead.name  || 'Unknown',
      phone:    lead.phone || '—',
      interest: lead.property_interest || 'Exploring',
      time:     new Date().toLocaleTimeString(),
      status:   'calling',
    };
    setLeads(prev => [newEntry, ...prev.slice(0, 49)]);
    setStats(prev => ({ ...prev, total: prev.total + 1, called: prev.called + 1 }));

    try {
      // Bridge: dials + Sarah speaks + listens + books
      const result = await AriaVoiceBridge.triggerCallWithLead(lead);

      // If booking happened, record it
      if (result?.booking) {
        const b = result.booking;
        setBookings(prev => [{
          id:       Date.now(),
          property: b.property_name || 'Property',
          client:   lead.name  || 'Lead',
          phone:    lead.phone || '—',
          date:     b.visit_date || '—',
          time:     b.visit_time || '—',
          at:       new Date().toLocaleTimeString(),
        }, ...prev.slice(0, 49)]);
        setStats(prev => ({ ...prev, booked: prev.booked + 1 }));
        setStatus(`✅ Booked visit for ${lead.name}!`);
      } else {
        setStatus('Aria is Live — Watching for Leads');
      }

      // Update leads log entry
      setLeads(prev => prev.map((l, i) =>
        i === 0 ? { ...l, status: result?.booking ? 'booked' : 'done' } : l
      ));

    } catch (err) {
      console.error('Call error:', err);
      setLeads(prev => prev.map((l, i) =>
        i === 0 ? { ...l, status: 'error' } : l
      ));
      setStatus('Aria is Live — Watching for Leads');
    }

    setIsOnCall(false);
    setCurrentLead(null);
  };

  // ── Toggle agent ON / OFF ─────────────────────
  const toggleAgent = async () => {
    if (isActive) {
      AriaVoiceBridge.stop();
      setIsActive(false);
      setIsOnCall(false);
      setCurrentLead(null);
      setStatus('Agent is OFF');
    } else {
      await AriaVoiceBridge.connect(BACKEND_URL);
      setIsActive(true);
      setStatus('Aria is Live — Watching for Leads');
      checkWAStatus();
    }
  };

  const checkWAStatus = async () => {
    try {
      const res  = await fetch(`${BACKEND_URL}/api/whatsapp/status`);
      const data = await res.json();
      setWaStatus(data.ready ? 'connected' : 'disconnected');
    } catch (e) {
      setWaStatus('disconnected');
    }
  };

  // ── Manual test call ──────────────────────────
  const manualCall = () => {
    Alert.prompt(
      'Manual Test Call',
      'Enter lead phone number:',
      (phone) => {
        if (phone?.trim()) {
          startCallForLead({
            name:              'Test Lead',
            phone:             phone.trim(),
            property_interest: '3BHK Apartment',
          });
        }
      },
      'plain-text', '+91'
    );
  };

  // ── RENDER ────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#07080f" />

      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <Text style={s.appName}>🏠 PropEdge <Text style={s.ai}>AI</Text></Text>
        <View style={[s.pill, isActive ? s.pillOn : s.pillOff]}>
          <Text style={s.pillTxt}>{isActive ? '● LIVE' : '○ OFF'}</Text>
        </View>
      </View>

      {/* ── TAB CONTENT ── */}
      {tab === 'home'   && <HomeTab     {...{ isActive, isOnCall, status, currentLead, stats, waStatus, toggleAgent, manualCall, BACKEND_URL }} />}
      {tab === 'leads'  && <LeadsTab    leads={leads}    />}
      {tab === 'books'  && <BookingsTab bookings={bookings} />}

      {/* ── BOTTOM TABS ── */}
      <View style={s.tabs}>
        {[
          { key: 'home',  label: '🏠 Home'     },
          { key: 'leads', label: '👤 Leads'    },
          { key: 'books', label: '📅 Bookings' },
        ].map(t => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════
// HOME TAB
// ════════════════════════════════════════════════
function HomeTab({ isActive, isOnCall, status, currentLead, stats, waStatus, toggleAgent, manualCall, BACKEND_URL }) {
  return (
    <ScrollView style={s.page} contentContainerStyle={{ paddingBottom: 20 }}>

      {/* Stats Row */}
      <View style={s.statsRow}>
        {[
          { label: 'Total Leads', value: stats.total,  color: '#6c63ff' },
          { label: 'Called',      value: stats.called, color: '#00c9a7' },
          { label: 'Booked',      value: stats.booked, color: '#f0c040' },
        ].map(st => (
          <View key={st.label} style={s.statCard}>
            <Text style={[s.statNum, { color: st.color }]}>{st.value}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* WhatsApp Status Card */}
      <TouchableOpacity
        style={[s.waCard, waStatus === 'connected' ? s.waConnected : s.waDisconnected]}
        onPress={() => {
          if (waStatus !== 'connected') {
            Alert.alert(
              'Connect WhatsApp',
              'Open your browser and go to the bridge URL /qr to scan the QR code with your WhatsApp.',
              [{ text: 'OK' }]
            );
          }
        }}
      >
        <Text style={s.waIcon}>{waStatus === 'connected' ? '✅' : '⚠️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.waTitle}>
            {waStatus === 'connected' ? 'WhatsApp Connected' :
             waStatus === 'checking'  ? 'Checking WhatsApp...' :
             'WhatsApp Not Connected'}
          </Text>
          <Text style={s.waSub}>
            {waStatus === 'connected'
              ? 'Messages send from your number'
              : 'Tap to learn how to connect'}
          </Text>
        </View>
        <Text style={{ color: waStatus === 'connected' ? '#00c9a7' : '#f0c040', fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      {/* Brain / Status */}
      <View style={s.brainCard}>
        <Text style={s.brainIcon}>
          {isOnCall ? '📞' : isActive ? '🧠' : '💤'}
        </Text>
        <Text style={s.statusTxt}>{status}</Text>

        {currentLead && (
          <View style={s.activeLead}>
            <Text style={s.activeLeadTitle}>Current Call</Text>
            <Text style={s.activeLeadName}>👤 {currentLead.name}</Text>
            <Text style={s.activeLeadPhone}>📞 {currentLead.phone}</Text>
            <Text style={s.activeLeadInt}>🏠 {currentLead.property_interest || 'Exploring'}</Text>
          </View>
        )}
      </View>

      {/* How it works */}
      {!isActive && (
        <View style={s.howCard}>
          <Text style={s.howTitle}>How it works</Text>
          {[
            '1. Tap Activate Agent',
            '2. Lead fills form on website',
            '3. App detects lead in 5 seconds',
            '4. Sarah auto-dials from your SIM',
            '5. AI talks, qualifies, books visit',
            '6. You see everything in Leads & Bookings',
          ].map(line => (
            <Text key={line} style={s.howLine}>{line}</Text>
          ))}
        </View>
      )}

      {/* Power Button */}
      <TouchableOpacity
        style={[s.powerBtn, isActive ? s.powerOff : s.powerOn]}
        onPress={toggleAgent}
      >
        <Text style={s.powerTxt}>
          {isActive ? '⏹  Turn OFF Agent' : '▶  Activate Agent'}
        </Text>
      </TouchableOpacity>

      {isActive && (
        <TouchableOpacity style={s.testBtn} onPress={manualCall}>
          <Text style={s.testTxt}>🔧 Manual Test Call</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════
// LEADS TAB
// ════════════════════════════════════════════════
function LeadsTab({ leads }) {
  const STATUS_COLOR = {
    calling: '#f0c040',
    done:    '#00c9a7',
    booked:  '#6c63ff',
    error:   '#e05060',
  };

  return (
    <ScrollView style={s.page}>
      <Text style={s.sectionTitle}>📋 Lead Call Log</Text>
      {leads.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyTxt}>No leads yet. Activate agent to start.</Text>
        </View>
      ) : leads.map(l => (
        <View key={l.id} style={s.leadRow}>
          <View style={s.leadLeft}>
            <Text style={s.leadName}>{l.name}</Text>
            <Text style={s.leadPhone}>{l.phone}</Text>
            <Text style={s.leadInt}>{l.interest}</Text>
          </View>
          <View style={s.leadRight}>
            <Text style={s.leadTime}>{l.time}</Text>
            <Text style={[s.leadStatus, { color: STATUS_COLOR[l.status] || '#fff' }]}>
              {l.status === 'calling' ? '🔄 Calling'
               : l.status === 'booked' ? '📅 Booked'
               : l.status === 'done'   ? '✅ Done'
               : '❌ Error'}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════
// BOOKINGS TAB
// ════════════════════════════════════════════════
function BookingsTab({ bookings }) {
  return (
    <ScrollView style={s.page}>
      <Text style={s.sectionTitle}>📅 AI Booked Visits</Text>
      {bookings.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>📅</Text>
          <Text style={s.emptyTxt}>No bookings yet. AI will book when leads confirm.</Text>
        </View>
      ) : bookings.map(b => (
        <View key={b.id} style={s.bookCard}>
          <View style={s.bookBadge}>
            <Text style={s.bookBadgeTxt}>✅ CONFIRMED</Text>
          </View>
          <Text style={s.bookProp}>🏠 {b.property}</Text>
          <Text style={s.bookClient}>👤 {b.client} — {b.phone}</Text>
          <Text style={s.bookDateTime}>📅 {b.date}  🕒 {b.time}</Text>
          <Text style={s.bookAt}>Booked by AI at {b.at}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════
const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: '#07080f' },
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#ffffff0f' },
  appName:         { color: '#f0c040', fontSize: 20, fontWeight: '900' },
  ai:              { color: '#6c63ff' },
  pill:            { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  pillOn:          { backgroundColor: '#00c9a720' },
  pillOff:         { backgroundColor: '#ffffff10' },
  pillTxt:         { color: '#fff', fontSize: 11, fontWeight: '700' },

  page:            { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

  statsRow:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:        { flex: 1, backgroundColor: '#12131f', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#ffffff08' },
  statNum:         { fontSize: 26, fontWeight: '900' },
  statLabel:       { color: '#ffffff50', fontSize: 11, marginTop: 3 },

  brainCard:       { backgroundColor: '#12131f', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#ffffff08' },
  brainIcon:       { fontSize: 64, marginBottom: 12 },
  statusTxt:       { color: '#ffffffcc', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  activeLead:      { marginTop: 16, backgroundColor: '#1e1f30', borderRadius: 12, padding: 14, width: '100%', borderWidth: 1, borderColor: '#f0c04030' },
  activeLeadTitle: { color: '#f0c040', fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  activeLeadName:  { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  activeLeadPhone: { color: '#ffffff70', fontSize: 13, marginBottom: 3 },
  activeLeadInt:   { color: '#6c63ff', fontSize: 12 },

  howCard:         { backgroundColor: '#12131f', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#ffffff08' },
  howTitle:        { color: '#ffffff80', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  howLine:         { color: '#ffffff50', fontSize: 12, marginBottom: 6, lineHeight: 18 },

  powerBtn:        { padding: 17, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  powerOn:         { backgroundColor: '#f0c040' },
  powerOff:        { backgroundColor: '#e05060' },
  powerTxt:        { color: '#000', fontWeight: '900', fontSize: 16 },
  testBtn:         { padding: 13, borderRadius: 14, alignItems: 'center', backgroundColor: '#12131f', borderWidth: 1, borderColor: '#ffffff12' },
  testTxt:         { color: '#ffffff60', fontSize: 13, fontWeight: '600' },

  sectionTitle:    { color: '#ffffff50', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  emptyBox:        { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:       { fontSize: 44, marginBottom: 12 },
  emptyTxt:        { color: '#ffffff30', fontSize: 13, textAlign: 'center' },

  leadRow:         { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#12131f', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#ffffff06' },
  leadLeft:        { flex: 1 },
  leadName:        { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  leadPhone:       { color: '#ffffff60', fontSize: 12, marginBottom: 3 },
  leadInt:         { color: '#6c63ff', fontSize: 11 },
  leadRight:       { alignItems: 'flex-end', justifyContent: 'space-between' },
  leadTime:        { color: '#ffffff30', fontSize: 11 },
  leadStatus:      { fontSize: 12, fontWeight: '600' },

  bookCard:        { backgroundColor: '#12131f', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#ffffff08' },
  bookBadge:       { backgroundColor: '#00c9a720', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10 },
  bookBadgeTxt:    { color: '#00c9a7', fontSize: 11, fontWeight: '800' },
  bookProp:        { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 5 },
  bookClient:      { color: '#ffffff70', fontSize: 13, marginBottom: 5 },
  bookDateTime:    { color: '#f0c040', fontSize: 13, fontWeight: '600', marginBottom: 5 },
  bookAt:          { color: '#ffffff30', fontSize: 11 },

  waCard:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1 },
  waConnected:     { backgroundColor: '#00c9a710', borderColor: '#00c9a730' },
  waDisconnected:  { backgroundColor: '#f0c04010', borderColor: '#f0c04030' },
  waIcon:          { fontSize: 22 },
  waTitle:         { color: '#fff', fontSize: 13, fontWeight: '700' },
  waSub:           { color: '#ffffff50', fontSize: 11, marginTop: 2 },
  tabs:            { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#ffffff0f', backgroundColor: '#07080f' },
  tab:             { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:       { borderTopWidth: 2, borderTopColor: '#f0c040' },
  tabTxt:          { color: '#ffffff40', fontSize: 12, fontWeight: '600' },
  tabTxtActive:    { color: '#f0c040' },
});
