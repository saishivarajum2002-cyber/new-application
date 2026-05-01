/**
 * Sarah Pro - Professional Native AI Agent
 * Features: Automatic Direct Dialing & WhatsApp Follow-ups
 */

import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, TouchableOpacity, 
  Image, ScrollView, Linking, Alert 
} from 'react-native';

// CONFIG (Update with your Vercel URL)
const CONFIG = {
  BASE_URL: 'https://new-application-tawny.vercel.app',
  API_SECRET: 'propedge_secret_2026',
  AGENT_NAME: 'Sarah Al-Rashid',
  POLL_INTERVAL: 10000
};

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [leads, setLeads] = useState([]);
  const [status, setStatus] = useState('Offline');

  // ── 1. BACKGROUND POLLING ──────────────────────────────────────
  useEffect(() => {
    let timer;
    if (isActive) {
      timer = setInterval(pollLeads, CONFIG.POLL_INTERVAL);
    }
    return () => clearInterval(timer);
  }, [isActive]);

  const pollLeads = async () => {
    try {
      const res = await fetch(`${CONFIG.BASE_URL}/api/leads/pending`, {
        headers: { 'x-api-secret': CONFIG.API_SECRET }
      });
      const data = await res.json();
      if (data.leads && data.leads.length > 0) {
        handleNewLead(data.leads[0]);
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  };

  // ── 2. THE AUTOMATIC FLOW ──────────────────────────────────────
  const handleNewLead = async (lead) => {
    console.log('🚀 Automatic Lead Detected:', lead.name);
    
    // STEP A: DIRECT DIAL (Automatic Call)
    // NOTE: This uses the CALL_PHONE permission we added to AndroidManifest
    const phoneUrl = `tel:${lead.phone}`;
    
    try {
      // In a real Native App, we use Intent.ACTION_CALL to skip the dialer button
      await Linking.openURL(phoneUrl); 
      
      // STEP B: WHATSAPP FOLLOW-UP (Triggered after call)
      setTimeout(() => {
        sendWhatsAppFollowup(lead);
      }, 15000); // Wait 15s to allow call to finish
      
    } catch (e) {
      Alert.alert('Dialing Error', 'Ensure SIM card is active.');
    }
  };

  const sendWhatsAppFollowup = (lead) => {
    const msg = `Hi ${lead.name}! I just tried calling you regarding your property interest in ${lead.property_interest || 'our project'}. Looking forward to connecting soon! - Sarah, Dream Homes Realty.`;
    const url = `whatsapp://send?phone=${lead.phone}&text=${encodeURIComponent(msg)}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        console.error("WhatsApp not installed");
      }
    });
  };

  // ── UI RENDERING ───────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>PropEdge PRO</Text>
        <View style={[styles.badge, isActive ? styles.badgeActive : {}]}>
          <Text style={styles.badgeText}>{isActive ? 'ACTIVE' : 'OFFLINE'}</Text>
        </View>
      </View>

      <View style={styles.agentCard}>
        <Image 
          source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=b8965a' }} 
          style={styles.avatar} 
        />
        <Text style={styles.agentName}>{CONFIG.AGENT_NAME}</Text>
        <Text style={styles.agentSub}>Professional AI Agent</Text>
        
        <TouchableOpacity 
          style={[styles.btn, isActive ? styles.btnStop : styles.btnStart]} 
          onPress={() => setIsActive(!isActive)}
        >
          <Text style={styles.btnText}>{isActive ? 'Deactivate Sarah' : 'Activate Sarah'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <ScrollView style={styles.feed}>
        {leads.length === 0 ? (
          <Text style={styles.empty}>Sarah is waiting for new leads...</Text>
        ) : (
          leads.map((l, i) => (
            <View key={i} style={styles.item}>
              <Text style={styles.itemName}>{l.name}</Text>
              <Text style={styles.itemDetail}>{l.phone}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0e', padding: 25 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40, marginTop: 20 },
  logo: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -1 },
  badge: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeActive: { backgroundColor: '#00ff88' },
  badgeText: { color: '#000', fontSize: 10, fontWeight: '800' },
  agentCard: { backgroundColor: '#1a1a18', padding: 30, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: '#b8965a33' },
  avatar: { width: 80, height: 80, borderRadius: 20, marginBottom: 15, backgroundColor: '#b8965a' },
  agentName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  agentSub: { color: '#a0a0a0', fontSize: 13, marginBottom: 25 },
  btn: { width: '100%', padding: 18, borderRadius: 15, alignItems: 'center' },
  btnStart: { backgroundColor: '#b8965a' },
  btnStop: { backgroundColor: '#333' },
  btnText: { fontWeight: '700', fontSize: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 40, marginBottom: 20 },
  feed: { flex: 1 },
  empty: { color: '#666', textAlign: 'center', marginTop: 20 },
  item: { backgroundColor: '#161614', padding: 20, borderRadius: 20, marginBottom: 10 },
  itemName: { color: '#fff', fontWeight: '600' },
  itemDetail: { color: '#b8965a', fontSize: 12, marginTop: 4 }
});
