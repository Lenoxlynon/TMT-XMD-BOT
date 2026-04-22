const express = require('express');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store active pairing sessions
const pairingSessions = new Map();

// ✅ FIXED: Dynamic import for Baileys ESM
let makeWASocket, useMultiFileAuthState;

async function loadBaileys() {
  const baileys = await import('@whiskeysockets/baileys');
  makeWASocket = baileys.default;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  console.log('✅ Baileys loaded successfully');
}

// HTML Page
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
            h1 { color: #667eea; margin-bottom: 10px; }
            .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
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
            button:hover { transform: scale(1.02); }
            button:disabled { opacity: 0.6; cursor: not-allowed; }
            #result {
                margin-top: 30px;
                padding: 20px;
                border-radius: 10px;
                display: none;
            }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
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
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔐 TMT-XMD-BOT</h1>
            <div class="subtitle">Generate Pairing Code for Session ID</div>
            
            <input type="text" id="phoneNumber" placeholder="263712345678" autocomplete="off">
            <small style="display: block; margin-bottom: 15px; color: #666;">Format: country code + number (no + or spaces)</small>
            
            <button id="generateBtn" onclick="generatePairing()">Generate Pairing Code</button>
            
            <div id="result"></div>
        </div>

        <script>
            let currentSessionId = 'tmt_' + Math.random().toString(36).substring(2, 10);
            
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
                
                if (!/^[0-9]+$/.test(phoneNumber)) {
                    resultDiv.className = 'error';
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '❌ Phone number must contain only numbers!';
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
    
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const sessionDir = path.join(__dirname, 'sessions', sessionId);
    
    try {
        // Ensure Baileys is loaded
        if (!makeWASocket) {
            await loadBaileys();
        }
        
        // Ensure session directory exists
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['TMT-XMD-BOT', 'Chrome', '120.0.0.0']
        });
        
        let pairingCode = null;
        let timeoutId = null;
        
        const connectionHandler = async (update) => {
            const { connection, qr } = update;
            
            if (qr && !pairingCode) {
                try {
                    pairingCode = await sock.requestPairingCode(cleanNumber);
                    res.json({ 
                        success: true, 
                        pairingCode: pairingCode,
                        sessionId: sessionId
                    });
                    
                    // Clean up after 3 minutes
                    timeoutId = setTimeout(() => {
                        sock.end(undefined, undefined, { reason: 'timeout' });
                    }, 180000);
                    
                } catch (err) {
                    console.error('Pairing code error:', err);
                    if (!res.headersSent) {
                        res.json({ success: false, error: err.message });
                    }
                }
            }
            
            if (connection === 'open') {
                console.log(`✅ Connected! Session: ${sessionId}`);
                if (timeoutId) clearTimeout(timeoutId);
            }
        };
        
        sock.ev.on('connection.update', connectionHandler);
        sock.ev.on('creds.update', saveCreds);
        
        // Set timeout for response
        setTimeout(() => {
            if (!res.headersSent) {
                res.json({ success: false, error: 'Timeout generating pairing code' });
                sock.end();
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
app.listen(PORT, async () => {
    // Pre-load Baileys on startup
    await loadBaileys();
    console.log(`\n🔐 TMT-XMD-BOT Pairing Server`);
    console.log(`📡 Running on port ${PORT}`);
    console.log(`🌐 Open your Render URL to generate pairing code\n`);
});

//tmt-usso-the-champ
