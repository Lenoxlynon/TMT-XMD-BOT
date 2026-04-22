/**
 * TMT-XMD-BOT Pairing Server
 * 
 * This server generates 8-digit pairing codes for WhatsApp authentication.
 * Users can link their WhatsApp account to the bot without scanning a QR code.
 * 
 * How it works:
 * 1. User enters phone number on the web page
 * 2. Server creates a temporary WhatsApp session
 * 3. WhatsApp sends an 8-digit code to the user's phone
 * 4. User enters the code in WhatsApp → Settings → Linked Devices
 * 5. Session is saved and can be used by the main bot
 * 
 * @author TMT-XMD-BOT
 * @version 1.0.0
 */

const express = require('express');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Store active pairing sessions in memory
// This prevents duplicate session creation for the same user
const pairingSessions = new Map();

// Baileys library variables (loaded dynamically because it's ESM-only)
let makeWASocket, useMultiFileAuthState;

/**
 * Dynamically imports the Baileys library
 * Baileys v7+ is ESM-only and cannot be used with require()
 * This function loads it asynchronously using import()
 */
async function loadBaileys() {
  const baileys = await import('@whiskeysockets/baileys');
  makeWASocket = baileys.default;
  useMultiFileAuthState = baileys.useMultiFileAuthState;
  console.log('✅ Baileys loaded successfully');
}

/**
 * Serves the main HTML page with the pairing form
 * Users enter their phone number here to generate a pairing code
 */
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>TMT-XMD-BOT - Pairing Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* Modern CSS styling for the pairing page */
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
            // Generate a random session ID with 'tmt_' prefix
            let currentSessionId = 'tmt_' + Math.random().toString(36).substring(2, 10);
            
            /**
             * Sends the phone number to the server to request a pairing code
             * Displays the 8-digit code when received
             */
            async function generatePairing() {
                const phoneNumber = document.getElementById('phoneNumber').value.trim();
                const resultDiv = document.getElementById('result');
                const generateBtn = document.getElementById('generateBtn');
                
                // Validate phone number input
                if (!phoneNumber) {
                    resultDiv.className = 'error';
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '❌ Please enter your phone number!';
                    return;
                }
                
                // Ensure only numbers are entered
                if (!/^[0-9]+$/.test(phoneNumber)) {
                    resultDiv.className = 'error';
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '❌ Phone number must contain only numbers!';
                    return;
                }
                
                // Show loading state
                generateBtn.disabled = true;
                generateBtn.innerHTML = '<span class="loading"></span> Generating...';
                resultDiv.style.display = 'block';
                resultDiv.className = 'info';
                resultDiv.innerHTML = '⏳ Connecting to WhatsApp... Please wait.';
                
                try {
                    // Request pairing code from server
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
                        // Display the 8-digit pairing code
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
                    // Re-enable button
                    generateBtn.disabled = false;
                    generateBtn.innerHTML = 'Generate Pairing Code';
                }
            }
        </script>
    </body>
    </html>
    `);
});

/**
 * API endpoint that generates a WhatsApp pairing code
 * 
 * Request body:
 * - phoneNumber: User's phone number (country code + number, no spaces)
 * - sessionId: Unique identifier for this pairing session
 * 
 * Response:
 * - success: boolean indicating if code was generated
 * - pairingCode: 8-digit code (if success)
 * - sessionId: The session ID (if success)
 * - error: Error message (if failed)
 */
app.post('/api/pair', async (req, res) => {
    const { phoneNumber, sessionId } = req.body;
    
    // Validate required fields
    if (!phoneNumber || !sessionId) {
        return res.json({ success: false, error: 'Missing phone number or session ID' });
    }
    
    // Remove any non-digit characters from phone number
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const sessionDir = path.join(__dirname, 'sessions', sessionId);
    
    try {
        // Ensure Baileys library is loaded before proceeding
        if (!makeWASocket) {
            await loadBaileys();
        }
        
        // Create session directory if it doesn't exist
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        // Load or create authentication state for this session
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Create a new WhatsApp socket connection
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }), // Suppress verbose logging
            browser: ['TMT-XMD-BOT', 'Chrome', '120.0.0.0']
        });
        
        let pairingCode = null;
        let timeoutId = null;
        
        // Handle connection events from WhatsApp
        const connectionHandler = async (update) => {
            const { connection, qr } = update;
            
            // When QR code is generated, request a pairing code instead
            if (qr && !pairingCode) {
                try {
                    // Request the 8-digit pairing code from WhatsApp
                    pairingCode = await sock.requestPairingCode(cleanNumber);
                    
                    // Send success response back to the client
                    res.json({ 
                        success: true, 
                        pairingCode: pairingCode,
                        sessionId: sessionId
                    });
                    
                    // Clean up the socket after 3 minutes if not used
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
            
            // When connection is successfully established
            if (connection === 'open') {
                console.log(`✅ Connected! Session: ${sessionId}`);
                if (timeoutId) clearTimeout(timeoutId);
            }
        };
        
        // Register event listeners
        sock.ev.on('connection.update', connectionHandler);
        sock.ev.on('creds.update', saveCreds);
        
        // Set a timeout for the entire pairing process (30 seconds)
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

/**
 * Start the Express server
 * Pre-loads Baileys on startup to reduce first-request latency
 */
app.listen(PORT, async () => {
    // Load Baileys library when server starts
    await loadBaileys();
    console.log(`\n🔐 TMT-XMD-BOT Pairing Server`);
    console.log(`📡 Running on port ${PORT}`);
    console.log(`🌐 Open your Render URL to generate pairing code\n`);
});

//tmt
