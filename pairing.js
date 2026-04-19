// pairing.js - Pairing Code Server for TMT-XMD-BOT
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Store active pairing sessions
const pairingSessions = new Map();

// HTML Page for pairing
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>TMT-XMD-BOT - Pairing Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                width: 100%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
            }
            h1 {
                color: #667eea;
                margin-bottom: 10px;
                font-size: 28px;
            }
            .subtitle {
                color: #666;
                margin-bottom: 30px;
                font-size: 14px;
            }
            input {
                width: 100%;
                padding: 15px;
                font-size: 18px;
                border: 2px solid #ddd;
                border-radius: 10px;
                margin-bottom: 20px;
                text-align: center;
                font-weight: bold;
            }
            input:focus {
                outline: none;
                border-color: #667eea;
            }
            button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 15px 30px;
                font-size: 18px;
                border-radius: 10px;
                cursor: pointer;
                width: 100%;
                font-weight: bold;
                transition: transform 0.2s;
            }
            button:hover {
                transform: scale(1.02);
            }
            button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            #result {
                margin-top: 30px;
                padding: 20px;
                border-radius: 10px;
                display: none;
            }
            .success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            .error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
            }
            .info {
                background: #d1ecf1;
                color: #0c5460;
                border: 1px solid #bee5eb;
            }
            .loading {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 10px;
                vertical-align: middle;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .code-box {
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 5px;
                background: #f0f0f0;
                padding: 20px;
                border-radius: 10px;
                margin: 15px 0;
                font-family: monospace;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔐 TMT-XMD-BOT</h1>
            <div class="subtitle">Generate Pairing Code for Session ID: <strong id="sessionDisplay">tmt_xxxx</strong></div>
            
            <input type="text" id="phoneNumber" placeholder="Enter your phone number" autocomplete="off">
            <small style="display: block; margin-bottom: 15px; color: #666;">Format: 263712345678 (country code + number, no + or spaces)</small>
            
            <button id="generateBtn" onclick="generatePairing()">Generate Pairing Code</button>
            
            <div id="result"></div>
        </div>

        <script>
            // Generate random session ID with TMT prefix
            function generateSessionId() {
                const random = Math.random().toString(36).substring(2, 10);
                return 'tmt_' + random;
            }
            
            let currentSessionId = generateSessionId();
            document.getElementById('sessionDisplay').textContent = currentSessionId;
            
            async function generatePairing() {
                const phoneNumber = document.getElementById('phoneNumber').value.trim();
                const resultDiv = document.getElementById('result');
                const generateBtn = document.getElementById('generateBtn');
                
                if (!phoneNumber) {
                    resultDiv.className = 'error';
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '❌ Please enter your phone number!';
                    return;
                }
                
                // Validate phone number (only numbers)
                if (!/^[0-9]+$/.test(phoneNumber)) {
                    resultDiv.className = 'error';
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '❌ Phone number must contain only numbers! No +, spaces, or dashes.';
                    return;
                }
                
                generateBtn.disabled = true;
                generateBtn.innerHTML = '<span class="loading"></span> Generating...';
                resultDiv.style.display = 'block';
                resultDiv.className = 'info';
                resultDiv.innerHTML = '⏳ Connecting to WhatsApp... Please wait.';
                
                try {
                    const response = await fetch('/api/pair', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            phoneNumber: phoneNumber,
                            sessionId: currentSessionId
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        resultDiv.className = 'success';
                        resultDiv.innerHTML = \`
                            ✅ <strong>Pairing Code Generated!</strong><br><br>
                            <div class="code-box">\${data.pairingCode}</div>
                            <p>📱 Open WhatsApp → Settings → Linked Devices → Link a Device</p>
                            <p>🔑 Enter this 8-digit code above</p>
                            <p><strong>Session ID:</strong> \${data.sessionId}</p>
                            <p style="margin-top: 15px; font-size: 12px;">⚠️ Save this Session ID! You'll need it in your config.js</p>
                        \`;
                    } else {
                        resultDiv.className = 'error';
                        resultDiv.innerHTML = \`❌ Error: \${data.error}\`;
                    }
                } catch (error) {
                    resultDiv.className = 'error';
                    resultDiv.innerHTML = \`❌ Connection error: \${error.message}\`;
                } finally {
                    generateBtn.disabled = false;
                    generateBtn.innerHTML = 'Generate Pairing Code';
                }
            }
        </script>
    </body>
    </html>
    `);
});

// API endpoint to generate pairing code
app.post('/api/pair', async (req, res) => {
    const { phoneNumber, sessionId } = req.body;
    
    if (!phoneNumber || !sessionId) {
        return res.json({ success: false, error: 'Missing phone number or session ID' });
    }
    
    // Clean phone number (remove any non-digits)
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Create unique session directory
    const sessionDir = path.join(__dirname, 'sessions', sessionId);
    
    try {
        // Check if already has an active pairing request
        if (pairingSessions.has(sessionId)) {
            const existing = pairingSessions.get(sessionId);
            if (Date.now() - existing.timestamp < 120000) { // 2 minutes
                return res.json({ 
                    success: true, 
                    pairingCode: existing.code,
                    sessionId: sessionId,
                    message: 'Using existing pairing code (valid for 2 minutes)'
                });
            }
        }
        
        // Ensure session directory exists
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Setup auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Create socket
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['TMT-XMD-BOT', 'Chrome', '120.0.0.0']
        });
        
        // Handle connection updates
        let pairingCode = null;
        let timeoutId = null;
        
        const connectionHandler = async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                // Generate pairing code instead of QR
                if (!sock.authState.creds.registered && !pairingCode) {
                    try {
                        const code = await sock.requestPairingCode(cleanNumber);
                        pairingCode = code;
                        
                        // Store in session map
                        pairingSessions.set(sessionId, {
                            code: pairingCode,
                            timestamp: Date.now(),
                            sock: sock
                        });
                        
                        // Send response
                        res.json({ 
                            success: true, 
                            pairingCode: pairingCode,
                            sessionId: sessionId
                        });
                        
                        // Clean up after 3 minutes
                        timeoutId = setTimeout(() => {
                            sock.end(undefined, undefined, { reason: 'timeout' });
                            pairingSessions.delete(sessionId);
                        }, 180000);
                        
                    } catch (err) {
                        console.error('Pairing code error:', err);
                        if (!res.headersSent) {
                            res.json({ success: false, error: err.message });
                        }
                        sock.end(undefined, undefined, { reason: 'error' });
                    }
                }
            }
            
            if (connection === 'open') {
                console.log(`✅ Connected! Session: ${sessionId}`);
                // Clear timeout on successful connection
                if (timeoutId) clearTimeout(timeoutId);
            }
            
            if (connection === 'close') {
                console.log(`❌ Connection closed for session: ${sessionId}`);
                pairingSessions.delete(sessionId);
            }
        };
        
        sock.ev.on('connection.update', connectionHandler);
        sock.ev.on('creds.update', saveCreds);
        
        // Set timeout for response
        setTimeout(() => {
            if (!res.headersSent) {
                res.json({ success: false, error: 'Timeout generating pairing code' });
                sock.end(undefined, undefined, { reason: 'timeout' });
                pairingSessions.delete(sessionId);
            }
        }, 30000);
        
    } catch (error) {
        console.error('Error:', error);
        if (!res.headersSent) {
            res.json({ success: false, error: error.message });
        }
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🔐 TMT-XMD-BOT Pairing Server`);
    console.log(`📡 Running on http://localhost:${PORT}`);
    console.log(`🌐 Open this URL in your browser to generate pairing code\n`);
});
