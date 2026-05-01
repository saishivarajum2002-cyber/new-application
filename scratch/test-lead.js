const fetch = require('node-fetch');

async function testLead() {
  const url = 'http://localhost:5000/api/leads';
  const payload = {
    agentEmail: 'saishivaraju.m2002@gmail.com',
    lead: {
      name: 'Test Lead',
      phone: '+918792474431',
      email: 'saishivaraju.m2002@gmail.com',
      property_interest: 'Luxury Villa in Downtown',
      budget: '2M - 4M',
      autoRespond: true
    }
  };

  console.log('🚀 Sending test lead to:', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-secret': 'propedge_secret_2026'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('🎉 Lead saved and AI call triggered successfully!');
    } else {
      console.error('❌ Lead submission failed.');
    }
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

testLead();
