require('dotenv').config();
const { sendWhatsAppText } = require('./services/whatsapp');

async function test() {
  console.log('Testing WhatsApp Integration...');
  const testPhone = process.env.AGENT_PHONE || '+971 50 123 4567'; 
  console.log(`Using token: ${process.env.WHATSAPP_ACCESS_TOKEN ? 'EXISTS' : 'MISSING'}`);
  console.log(`Using Phone ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID ? 'EXISTS' : 'MISSING'}`);
  
  const res = await sendWhatsAppText(testPhone, 'Hello from PropEdge AI! Your WhatsApp integration is now ACTIVE. 🚀');
  console.log('Result:', res);
}

test();
