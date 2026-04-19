const axios = require('axios');

// Conversation memory (stores last 5 messages per user)
const conversationMemory = new Map();

// Clear old conversations every hour to save memory
setInterval(() => {
    conversationMemory.clear();
}, 3600000);

// Your Gemini API key (already added)
const GEMINI_API_KEY = 'AIzaSyCIEdnSiQbogqLvtE0shYBbxMfDjmqbpsU';

module.exports = {
    name: 'chatbot',
    alias: ['ai', 'bot', 'gemini'],
    description: 'Toggle AI auto-reply or ask AI directly',
    category: 'ai',
    async execute(TmT, message, args, command) {
        const isGroup = message.key.remoteJid.endsWith('@g.us');
        const sender = message.key.participant || message.key.remoteJid;
        
        // Command: .chatbot on/off - Toggle auto-reply
        if (args[0] && (args[0].toLowerCase() === 'on' || args[0].toLowerCase() === 'off')) {
            const userPref = global.chatbotPrefs || {};
            userPref[sender] = args[0].toLowerCase() === 'on';
            global.chatbotPrefs = userPref;
            
            return TmT.sendMessage(message.key.remoteJid, {
                text: `🤖 AI Chatbot is now *${args[0].toUpperCase()}*!\n\nI will ${args[0].toLowerCase() === 'on' ? 'automatically reply to your messages' : 'only reply when you use .ask'}`
            });
        }
        
        // Command: .ask <question> - Ask AI directly
        if (command === 'ask' && args.length > 0) {
            const question = args.join(' ');
            await TmT.sendMessage(message.key.remoteJid, { text: `🤔 Thinking...` });
            
            const aiResponse = await getAIResponse(question, sender);
            await TmT.sendMessage(message.key.remoteJid, { text: aiResponse });
            return;
        }
        
        // Auto-reply logic
        const isEnabled = global.chatbotPrefs?.[sender] === true;
        if (!isEnabled) return;
        
        const botNumber = TmT.user.id?.split(':')[0] + '@s.whatsapp.net';
        if (sender === botNumber) return;
        
        if (isGroup) {
            const isMentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(botNumber);
            const isRepliedToBot = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stanzaId;
            if (!isMentioned && !isRepliedToBot) return;
        }
        
        let userMessage = '';
        if (message.message?.conversation) {
            userMessage = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            userMessage = message.message.extendedTextMessage.text;
        }
        
        if (!userMessage) return;
        
        // Remove bot mention from message
        userMessage = userMessage.replace(/@\d+[\s\S]*?/, '').trim();
        if (userMessage.length === 0) return;
        
        await TmT.sendPresenceUpdate('composing', message.key.remoteJid);
        const aiResponse = await getAIResponse(userMessage, sender);
        
        await TmT.sendMessage(message.key.remoteJid, {
            text: aiResponse
        });
    }
};

async function getAIResponse(userMessage, userId) {
    try {
        let history = conversationMemory.get(userId) || [];
        history.push({ role: "user", parts: [{ text: userMessage }] });
        if (history.length > 10) history = history.slice(-10);
        
        // ✅ FIXED: Check if API key is missing or still the placeholder
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'AIzaSyCIEdnSiQbogqLvtE0shYBbxMfDjmqbpsU' || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
            const fallbacks = [
                "I'm your AI assistant! To get full AI responses, add your Gemini API key to the chatbot.js file.",
                "Great question! You'll need to get a free Gemini API key from Google AI Studio to enable full AI features.",
                "I can help with that! Visit aistudio.google.com to get your free API key and unlock my full potential."
            ];
            return fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
        
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: history,
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 500,
                }
            },
            { timeout: 15000 }
        );
        
        if (!response.data.candidates || response.data.candidates.length === 0) {
            return "⚠️ No response from AI. Please try again.";
        }
        
        const aiReply = response.data.candidates[0].content.parts[0].text;
        history.push({ role: "model", parts: [{ text: aiReply }] });
        conversationMemory.set(userId, history);
        
        return aiReply;
        
    } catch (error) {
        console.error('AI Error:', error.response?.data || error.message);
        
        // Handle specific API errors
        if (error.response?.status === 403) {
            return "⚠️ API key is invalid or expired. Please check your Gemini API key.";
        }
        if (error.response?.status === 429) {
            return "⚠️ Rate limit exceeded. Please try again later.";
        }
        
        return "⚠️ Sorry, I'm having trouble thinking right now. Please try again in a moment.";
    }
}
