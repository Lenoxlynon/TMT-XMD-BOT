/**
 * TMT-XMD-BOT Pairing Server
 * 
 * This server generates 8-digit pairing codes for WhatsApp authentication.
 * Users can link their WhatsApp account to the bot without scanning a QR code.
 * 
 * How it works:
 * 1. User enters phone number on the web page
 * 2. Server validates the phone number format
 * 3. Server creates a temporary WhatsApp session
 * 4. WhatsApp sends an 8-digit code to the user's phone
 * 5. User enters the code in WhatsApp → Settings → Linked Devices
 * 6. Session is saved and can be used by the main bot
 * 
 * @author TMT-XMD-BOT
 * @version 1.0.0
 */

const express = require('express');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// ============================================================
// EXPRESS APP INITIALIZATION
// ============================================================

/**
 * Initialize Express application
 * @constant {Object} app - Express application instance
 */
const app = express();

/**
 * Server port - uses environment variable or defaults to 3000
 * Render.com automatically sets the PORT environment variable
 * @constant {number} PORT
 */
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE CONFIGURATION
// ============================================================

/**
 * Parse incoming JSON request bodies
 * Required for API endpoint to read phoneNumber and sessionId
 */
app.use(express.json());

/**
 * Parse URL-encoded request bodies (form data)
 * Supports both JSON and form submissions
 */
app.use(express.urlencoded({ extended: true }));

// ============================================================
// IN-MEMORY STORAGE
// ============================================================

/**
 * Store active pairing sessions in memory
 * Prevents duplicate session creation for the same user
 * Map structure: sessionId -> { code, timestamp, socket }
 * 
 * @constant {Map<string, Object>} pairingSessions
 */
const pairingSessions = new Map();

// ============================================================
// BAILEYS ESM LOADER
// ============================================================

/**
 * Baileys library variables (loaded dynamically)
 * Baileys v7+ is ESM-only and cannot be used with require()
 * These variables are populated by loadBaileys() function
 */
let makeWASocket;           // Function to create WhatsApp socket connection
let useMultiFileAuthState;  // Function to manage authentication state

/**
 * Dynamically imports the Baileys library
 * 
 * Why dynamic import?
 * - Baileys v7+ is pure ESM (ECMAScript Module)
 * - Our bot uses CommonJS (require())
 * - Dynamic import() allows ESM modules to load in CommonJS
 * 
 * @async
 * @function loadBaileys
 * @returns {Promise<void>}
 * @throws {Error} If Baileys fails to load
 */
async function loadBaileys() {
  try {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    console.log('✅ Baileys library loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load Baileys:', error.message);
    throw error;
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Validates and formats a phone number
 * 
 * @function validatePhoneNumber
 * @param {string} phoneNumber - Raw phone number input
 * @returns {Object} Validation result
 * @returns {boolean} isValid - Whether the phone number is valid
 * @returns {string} cleanNumber - Formatted phone number (digits only)
 * @returns {string} error - Error message if invalid
 */
function validatePhoneNumber(phoneNumber) {
  // Check if phone number is provided
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return {
      isValid: false,
      cleanNumber: null,
      error: 'Phone number is required'
    };
  }
  
  // Remove all whitespace
  let cleaned = phoneNumber.trim();
  
  // Remove leading '+' if present (common in international format)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Remove any non-digit characters (spaces, dashes, parentheses, etc.)
  const digitsOnly = cleaned.replace(/\D/g, '');
  
  // Validate length (minimum 9 digits, maximum 15 digits)
  // Most phone numbers are between 9-15 digits
  if (digitsOnly.length < 9) {
    return {
      isValid: false,
      cleanNumber: null,
      error: 'Phone number is too short (minimum 9 digits)'
    };
  }
  
  if (digitsOnly.length > 15) {
    return {
      isValid: false,
      cleanNumber: null,
      error: 'Phone number is too long (maximum 15 digits)'
    };
  }
  
  // Validate that it contains at least one non-zero digit (basic sanity check)
  if (!/[1-9]/.test(digitsOnly)) {
    return {
      isValid: false,
      cleanNumber: null,
      error: 'Invalid phone number format'
    };
  }
  
  return {
    isValid: true,
    cleanNumber: digitsOnly,
    error: null
  };
}

/**
 * Validates session ID format
 * 
 * @function validateSessionId
 * @param {string} sessionId - Session ID to validate
 * @returns {Object} Validation result
 */
function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return {
      isValid: false,
      error: 'Session ID is required'
    };
  }
  
  // Session ID should start with 'tmt_' and contain only alphanumeric chars and underscore
  const validPattern = /^tmt_[a-zA-Z0-9]{6,10}$/;
  
  if (!validPattern.test(sessionId)) {
    return {
      isValid: false,
      error: 'Invalid session ID format. Expected: tmt_ followed by 6-10 alphanumeric characters'
    };
  }
  
  return {
    isValid: true,
    error: null
  };
}

// ============================================================
// ROUTES
// ============================================================

/**
 * Serves the main HTML page with the pairing form
 * Users enter their phone number here to generate a pairing code
 * 
 * @route GET /
 * @returns {HTML} Beautiful pairing form page
 */
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
        <title>TMT-XMD-BOT - Pairing Code Generator</title>
        <meta name="description" content="Generate WhatsApp pairing code for TMT-XMD-BOT">
        <style>
            /* Reset and base styles */
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            /* Gradient background */
            body {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                padding: 20px;
            }
            
            /* Card container */
            .container {
                background: white;
                border-radius: 24px;
                padding: 40px 32px;
                max-width: 500px;
                width: 100%;
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                text-align: center;
                transition: transform 0.2s ease;
            }
            
            /* Typography */
            h1 {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                -webkit-background-clip: text;
                background-clip: text;
                color: transparent;
                margin-bottom: 8px;
                font-size: 28px;
            }
            
            .subtitle {
                color: #6b7280;
                margin-bottom: 32px;
                font-size: 14px;
                line-height: 1.5;
            }
            
            /* Form elements */
            .input-group {
                margin-bottom: 20px;
                text-align: left;
            }
            
            .input-label {
                display: block;
                font-size: 14px;
                font-weight: 500;
                color: #374151;
                margin-bottom: 8px;
            }
            
            input {
                width: 100%;
                padding: 14px 16px;
                font-size: 18px;
                border: 2px solid #e5e7eb;
                border-radius: 12px;
                text-align: center;
                font-weight: 500;
                transition: all 0.2s ease;
                font-family: monospace;
            }
            
            input:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102,126,234,0.1);
            }
            
            .input-hint {
                display: block;
                font-size: 12px;
                color: #9ca3af;
                margin-top: 8px;
                text-align: center;
            }
            
            button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 14px 24px;
                font-size: 16px;
                font-weight: 600;
                border-radius: 12px;
                cursor: pointer;
                width: 100%;
                transition: transform 0.15s ease, opacity 0.15s ease;
            }
            
            button:hover:not(:disabled) {
                transform: translateY(-1px);
            }
            
            button:active:not(:disabled) {
                transform: translateY(0);
            }
            
            button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            /* Result messages */
            #result {
                margin-top: 24px;
                padding: 16px;
                border-radius: 12px;
                display: none;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .success {
                background: #d1fae5;
                color: #065f46;
                border: 1px solid #a7f3d0;
            }
            
            .error {
                background: #fee2e2;
                color: #991b1b;
                border: 1px solid #fecaca;
            }
            
            .info {
                background: #dbeafe;
                color: #1e40af;
                border: 1px solid #bfdbfe;
            }
            
            .code-box {
                font-size: 36px;
                font-weight: bold;
                letter-spacing: 8px;
                background: #f9fafb;
                padding: 20px;
                border-radius: 12px;
                margin: 16px 0;
                font-family: 'Courier New', monospace;
                border: 1px dashed #667eea;
            }
            
            /* Loading spinner */
            .loading {
                display: inline-block;
                width: 18px;
                height: 18px;
                border: 2px solid rgba(255,255,255,0.3);
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-right: 8px;
                vertical-align: middle;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Footer */
            .footer {
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
                font-size: 11px;
                color: #9ca3af;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔐 TMT-XMD-BOT</h1>
            <div class="subtitle">Generate Pairing Code for WhatsApp Authentication</div>
            
            <div class="input-group">
                <label class="input-label">📱 Phone Number</label>
                <input type="tel" id="phoneNumber" placeholder="263712345678" autocomplete="off" inputmode="numeric">
                <small class="input-hint">Format: Country code + number (no +, spaces, or dashes)</small>
                <small class="input-hint">Example: 263712345678 (Zimbabwe) or 277491234567 (South Africa)</small>
            </div>
            
            <button id="generateBtn" onclick="generatePairing()">Generate Pairing Code</button>
            
            <div id="result"></div>
            <div class="footer">
                <span>⚠️ Code expires in 2 minutes • Save your Session ID</span>
            </div>
        </div>

        <script>
            // Generate a unique session ID with 'tmt_' prefix
            const randomStr = Math.random().toString(36).substring(2, 12);
            let currentSessionId = 'tmt_' + randomStr;
            
            /**
             * Validates phone number input on client side
             * @param {string} phone - Raw phone number input
             * @returns {Object} Validation result
             */
            function validatePhoneInput(phone) {
                if (!phone || phone.trim() === '') {
                    return { valid: false, message: 'Please enter your phone number' };
                }
                
                // Remove any non-digit characters for validation
                const digitsOnly = phone.replace(/\\D/g, '');
                
                if (digitsOnly.length < 9) {
                    return { valid: false, message: 'Phone number is too short (minimum 9 digits)' };
                }
                
                if (digitsOnly.length > 15) {
                    return { valid: false, message: 'Phone number is too long (maximum 15 digits)' };
                }
                
                return { valid: true, message: null };
            }
            
            /**
             * Formats phone number by removing all non-digit characters
             * @param {string} phone - Raw phone number
             * @returns {string} Cleaned phone number
             */
            function cleanPhoneNumber(phone) {
                return phone.replace(/\\D/g, '');
            }
            
            /**
             * Displays an error message in the result div
             * @param {string} message - Error message to display
             */
            function showError(message) {
                const resultDiv = document.getElementById('result');
                resultDiv.className = 'error';
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '❌ ' + message;
            }
            
            /**
             * Sends the phone number to the server to request a pairing code
             * Displays the 8-digit code when received
             */
            async function generatePairing() {
                const phoneInput = document.getElementById('phoneNumber');
                const phoneNumber = phoneInput.value.trim();
                const resultDiv = document.getElementById('result');
                const generateBtn = document.getElementById('generateBtn');
                
                // Clear previous results
                resultDiv.style.display = 'none';
                
                // Client-side validation
                const validation = validatePhoneInput(phoneNumber);
                if (!validation.valid) {
                    showError(validation.message);
                    phoneInput.focus();
                    return;
                }
                
                // Clean the phone number before sending
                const cleanedNumber = cleanPhoneNumber(phoneNumber);
                
                // Show loading state
                generateBtn.disabled = true;
                generateBtn.innerHTML = '<span class="loading"></span> Generating...';
                resultDiv.style.display = 'block';
                resultDiv.className = 'info';
                resultDiv.innerHTML = '⏳ Connecting to WhatsApp servers... Please wait (10-20 seconds).';
                
                try {
                    // Request pairing code from server
                    const response = await fetch('/api/pair', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ 
                            phoneNumber: cleanedNumber,
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
                            <p>📱 <strong>Next Steps:</strong></p>
                            <ol style="text-align: left; margin: 12px 20px;">
                                <li>Open WhatsApp on your phone</li>
                                <li>Go to Settings → Linked Devices → Link a Device</li>
                                <li>Enter the 8-digit code above</li>
                            </ol>
                            <hr style="margin: 16px 0; border-color: #a7f3d0;">
                            <p><strong>🔑 Session ID:</strong> <code>\${data.sessionId}</code></p>
                            <p style="margin-top: 12px; font-size: 12px;">⚠️ <strong>Save this Session ID!</strong> Add it to your config.js file.</p>
                        \`;
                    } else {
                        showError(data.error || 'Failed to generate pairing code');
                    }
                } catch (error) {
                    console.error('Fetch error:', error);
                    showError('Network error: Could not connect to server. Please try again.');
                } finally {
                    // Re-enable button
                    generateBtn.disabled = false;
                    generateBtn.innerHTML = 'Generate Pairing Code';
                }
            }
            
            // Add input validation on the phone field
            document.getElementById('phoneNumber').addEventListener('input', function(e) {
                // Remove any non-digit characters as the user types
                this.value = this.value.replace(/[^0-9]/g, '');
            });
        </script>
    </body>
    </html>
    `);
});

/**
 * API endpoint that generates a WhatsApp pairing code
 * 
 * @route POST /api/pair
 * @param {Object} req - Express request object
 * @param {string} req.body.phoneNumber - User's phone number (digits only)
 * @param {string} req.body.sessionId - Unique identifier for this pairing session
 * @param {Object} res - Express response object
 * 
 * @returns {Object} JSON response
 * @returns {boolean} success - Whether code was generated
 * @returns {string} pairingCode - 8-digit code (if success)
 * @returns {string} sessionId - The session ID (if success)
 * @returns {string} error - Error message (if failed)
 */
app.post('/api/pair', async (req, res) => {
    const { phoneNumber, sessionId } = req.body;
    
    // ============================================================
    // INPUT VALIDATION
    // ============================================================
    
    // Validate phone number
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
        console.warn(`❌ Phone validation failed: ${phoneValidation.error}`);
        return res.status(400).json({ 
            success: false, 
            error: phoneValidation.error 
        });
    }
    
    // Validate session ID
    const sessionValidation = validateSessionId(sessionId);
    if (!sessionValidation.isValid) {
        console.warn(`❌ Session validation failed: ${sessionValidation.error}`);
        return res.status(400).json({ 
            success: false, 
            error: sessionValidation.error 
        });
    }
    
    const cleanNumber = phoneValidation.cleanNumber;
    const sessionDir = path.join(__dirname, 'sessions', sessionId);
    
    // Log the pairing request (without exposing full phone number)
    const maskedNumber = cleanNumber.slice(0, -4) + '****';
    console.log(`📱 Pairing request for: ${maskedNumber} | Session: ${sessionId}`);
    
    try {
        // ============================================================
        // BAILEYS INITIALIZATION
        // ============================================================
        
        // Ensure Baileys library is loaded before proceeding
        if (!makeWASocket) {
            console.log('⏳ Loading Baileys library...');
            await loadBaileys();
        }
        
        // Create session directory if it doesn't exist
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
            console.log(`📁 Created session directory: ${sessionId}`);
        }
        
        // Load or create authentication state for this session
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        // Create a new WhatsApp socket connection
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }), // Suppress verbose logging
            browser: ['TMT-XMD-BOT', 'Chrome', '120.0.0.0'],
            defaultQueryTimeoutMs: 15000, // 15 second timeout
            keepAliveIntervalMs: 10000,   // Keep connection alive
        });
        
        let pairingCode = null;
        let timeoutId = null;
        let isResponded = false;
        
        // ============================================================
        // CONNECTION EVENT HANDLER
        // ============================================================
        
        /**
         * Handles WhatsApp connection events and generates pairing code
         */
        const connectionHandler = async (update) => {
            const { connection, qr, lastDisconnect } = update;
            
            // When QR code is generated, request a pairing code instead
            if (qr && !pairingCode && !isResponded) {
                try {
                    console.log(`🔑 Requesting pairing code for ${maskedNumber}...`);
                    // Request the 8-digit pairing code from WhatsApp
                    pairingCode = await sock.requestPairingCode(cleanNumber);
                    isResponded = true;
                    
                    console.log(`✅ Pairing code generated for ${maskedNumber}: ${pairingCode}`);
                    
                    // Send success response back to the client
                    res.json({ 
                        success: true, 
                        pairingCode: pairingCode,
                        sessionId: sessionId
                    });
                    
                    // Clean up the socket after 3 minutes if not used
                    timeoutId = setTimeout(() => {
                        console.log(`⏰ Cleaning up session ${sessionId} due to timeout`);
                        sock.end(undefined, undefined, { reason: 'timeout' });
                        pairingSessions.delete(sessionId);
                    }, 180000); // 3 minutes
                    
                } catch (err) {
                    console.error(`❌ Pairing code error for ${maskedNumber}:`, err.message);
                    if (!isResponded && !res.headersSent) {
                        isResponded = true;
                        res.status(500).json({ 
                            success: false, 
                            error: err.message || 'Failed to generate pairing code'
                        });
                    }
                }
            }
            
            // When connection is successfully established
            if (connection === 'open') {
                console.log(`✅ WhatsApp connection established for session: ${sessionId}`);
                if (timeoutId) clearTimeout(timeoutId);
            }
            
            // Handle connection errors
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`🔌 Connection closed for session ${sessionId}, status: ${statusCode}`);
                pairingSessions.delete(sessionId);
            }
        };
        
        // Register event listeners
        sock.ev.on('connection.update', connectionHandler);
        sock.ev.on('creds.update', saveCreds);
        
        // ============================================================
        // TIMEOUT HANDLING
        // ============================================================
        
        // Set a timeout for the entire pairing process (45 seconds)
        // This is longer than the default to accommodate slow connections
        setTimeout(() => {
            if (!isResponded && !res.headersSent) {
                isResponded = true;
                console.error(`⏰ Timeout for session ${sessionId}`);
                res.status(408).json({ 
                    success: false, 
                    error: 'Request timeout. Please try again.'
                });
                sock.end();
                pairingSessions.delete(sessionId);
            }
        }, 45000); // 45 seconds
        
    } catch (error) {
        console.error('❌ Server error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: 'Internal server error. Please try again later.'
            });
        }
    }
});

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

/**
 * Health check endpoint for monitoring
 * Used by Render to verify the service is running
 * 
 * @route GET /health
 * @returns {Object} Status of the server
 */
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeSessions: pairingSessions.size
    });
});

// ============================================================
// SERVER STARTUP
// ============================================================

/**
 * Start the Express server
 * Pre-loads Baileys on startup to reduce first-request latency
 */
app.listen(PORT, async () => {
    console.log('\n' + '='.repeat(50));
    console.log('🔐 TMT-XMD-BOT Pairing Server');
    console.log('='.repeat(50));
    console.log(`📡 Server running on port: ${PORT}`);
    console.log(`🌐 Open URL: http://localhost:${PORT}`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log('='.repeat(50) + '\n');
    
    // Load Baileys library when server starts
    console.log('⏳ Pre-loading Baileys library...');
    await loadBaileys();
    console.log('✅ Server ready to generate pairing codes!\n');
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

/**
 * Handle graceful shutdown on process termination
 * Cleans up active sessions to prevent memory leaks
 */
process.on('SIGTERM', async () => {
    console.log('⚠️ Received SIGTERM, shutting down gracefully...');
    
    // Close all active sessions
    for (const [sessionId, session] of pairingSessions.entries()) {
        if (session.sock) {
            await session.sock.end();
        }
    }
    
    console.log('✅ All sessions closed. Exiting...');
    process.exit(0);
});
