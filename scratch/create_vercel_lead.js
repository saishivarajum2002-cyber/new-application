const https = require('https');

const data = JSON.stringify({
  agentEmail: 'saishivaraju.m2002@gmail.com',
  lead: {
    name: 'Real Estate Lead (Vercel)',
    phone: '8792474431',
    email: 'test@propedge.ai',
    property_interest: 'Luxury Villa',
    source: 'Vercel Test'
  }
});

const options = {
  hostname: 'agent-leads.vercel.app',
  path: '/api/leads',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'x-api-secret': 'propedge_secret_2026'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.write(data);
req.end();
