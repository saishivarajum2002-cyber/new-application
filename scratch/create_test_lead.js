const http = require('http');

const data = JSON.stringify({
  agentEmail: 'saishivaraju.m2002@gmail.com', // Using the email from .env
  lead: {
    name: 'Real Estate Lead',
    phone: '8792474431',
    email: 'test@propedge.ai',
    property_interest: 'Luxury Villa',
    source: 'Manual Test'
  }
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/leads',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'x-api-secret': 'propedge_secret_2026'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
