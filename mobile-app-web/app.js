/**
 * PropEdge Mobile Agent Logic
 * (Non-Expo Version for Capacitor/Web-to-APK)
 */

const CONFIG = {
    BASE_URL: 'https://agent-leads.vercel.app', // Update this to your deployed URL
    POLL_INTERVAL: 10000, // 10 seconds
    AGENT_NAME: 'Sarah',
    API_SECRET: 'propedge_secret_2026'
};

let isAgentActive = false;
let pollingTimer = null;
let stats = { leads: 0, calls: 0, bookings: 0 };

// ── UI Elements ──────────────────────────────────────────────────────────────
const toggleBtn = document.getElementById('toggle-agent-btn');
const statusBadge = document.getElementById('agent-status-badge');
const statusText = document.getElementById('status-text');
const activityList = document.getElementById('activity-list');
const countLeads = document.getElementById('count-leads');
const countCalls = document.getElementById('count-calls');
const countBookings = document.getElementById('count-bookings');
const callOverlay = document.getElementById('call-overlay');

// ── Agent Control ────────────────────────────────────────────────────────────
toggleBtn.addEventListener('click', () => {
    isAgentActive = !isAgentActive;
    
    if (isAgentActive) {
        startAgent();
    } else {
        stopAgent();
    }
});

function startAgent() {
    toggleBtn.textContent = 'Deactivate Agent';
    toggleBtn.style.background = '#333';
    toggleBtn.style.color = '#fff';
    statusBadge.classList.add('active');
    statusText.textContent = 'ACTIVE';
    addActivity('System', 'Sarah Al-Rashid is now online and polling.');
    
    // Start polling
    pollForLeads();
    pollingTimer = setInterval(pollForLeads, CONFIG.POLL_INTERVAL);
}

function stopAgent() {
    toggleBtn.textContent = 'Activate AI Agent';
    toggleBtn.style.background = 'linear-gradient(to right, #b8965a, #8e7345)';
    toggleBtn.style.color = 'black';
    statusBadge.classList.remove('active');
    statusText.textContent = 'OFFLINE';
    addActivity('System', 'Agent deactivated.');
    
    if (pollingTimer) clearInterval(pollingTimer);
}

// ── Lead Polling ────────────────────────────────────────────────────────────
async function pollForLeads() {
    console.log('🔍 Polling for new leads...');
    try {
        const res = await fetch(`${CONFIG.BASE_URL}/api/leads/pending`, {
            headers: { 'x-api-secret': CONFIG.API_SECRET }
        });
        const data = await res.json();
        
        if (data.leads && data.leads.length > 0) {
            const lead = data.leads[0]; // Take the freshest lead
            handleNewLead(lead);
        }
    } catch (e) {
        console.error('Polling error:', e);
    }
}

async function handleNewLead(lead) {
    addActivity('New Lead', `${lead.name} (${lead.phone})`);
    updateStats('leads', 1);
    
    // Trigger the voice bridge
    startVoiceCall(lead);
}

// ── Voice Call Bridge ───────────────────────────────────────────────────────
function startVoiceCall(lead) {
    if (!isAgentActive) return;

    updateStats('calls', 1);
    
    // Show Call UI
    document.getElementById('lead-name-calling').textContent = lead.name || 'Unknown';
    document.getElementById('lead-phone-calling').textContent = lead.phone;
    callOverlay.classList.remove('hidden');

    // Step 1: Open Dialer (Standard Web intent)
    // Note: In an APK/WebView, this triggers the system dialer
    window.location.href = `tel:${lead.phone}`;

    // Step 2: Sarah starts speaking (delayed to allow call to connect)
    setTimeout(() => {
        sarahSpeak(`Hi ${lead.name || 'there'}! This is Sarah calling from Dream Homes Realty. I saw you were looking for a property on our website?`);
    }, 8000);
}

function sarahSpeak(text) {
    console.log('Sarah says:', text);
    // Use Web Speech API for free TTS (or link to your ElevenLabs bridge)
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
}

document.getElementById('end-call-btn').addEventListener('click', () => {
    callOverlay.classList.add('hidden');
    addActivity('Call Ended', 'Interaction logged.');
});

// ── Utilities ───────────────────────────────────────────────────────────────
function addActivity(type, msg) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const html = `
        <div class="activity-item">
            <div class="activity-info">
                <h4>${type}</h4>
                <p>${msg}</p>
            </div>
            <div class="activity-time">${time}</div>
        </div>
    `;
    
    if (activityList.querySelector('.empty-state')) {
        activityList.innerHTML = html;
    } else {
        activityList.insertAdjacentHTML('afterbegin', html);
    }
}

function updateStats(key, inc) {
    stats[key] += inc;
    countLeads.textContent = stats.leads;
    countCalls.textContent = stats.calls;
    countBookings.textContent = stats.bookings;
}
