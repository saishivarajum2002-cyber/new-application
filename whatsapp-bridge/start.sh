#!/bin/bash
# ─────────────────────────────────────────────────────
# PropEdge WhatsApp Bridge — Start Script
# Run this in Termux: bash start.sh
# ─────────────────────────────────────────────────────
echo "🏠 PropEdge WhatsApp Bridge"
echo "─────────────────────────────"

# Install Node deps if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing Node dependencies..."
  npm install
fi

# Install Python deps if needed
echo "📦 Installing Python dependencies..."
pip install flask requests --break-system-packages -q

# Start Node WhatsApp bridge in background
echo "🟢 Starting WhatsApp bridge (Node.js)..."
node server.js &
NODE_PID=$!
echo "   Node PID: $NODE_PID"

# Wait for Node to start
sleep 3

# Start Python API
echo "🐍 Starting Python API..."
python3 whatsapp_api.py &
PYTHON_PID=$!
echo "   Python PID: $PYTHON_PID"

echo ""
echo "✅ Both services started!"
echo "📱 Scan QR at: http://localhost:3001/qr"
echo ""
echo "Press Ctrl+C to stop both services."

# Wait and cleanup on exit
trap "kill $NODE_PID $PYTHON_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
