/**
 * Misc Command - Generate meme-style images with avatars
 * Creates heart, horny, circle, LGBT, tweet, YouTube comment images, etc.
 */

const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Upload image to temporary hosting (required for some features)
// Simple upload function using imgbb or similar
async function uploadToImgbb(buffer) {
    try {
        // Free imgbb API (get key from https://imgbb.com)
        const apiKey = 'YOUR_IMGBB_API_KEY'; // Replace with your key or use direct buffer
        const formData = new FormData();
        formData.append('image', buffer.toString('base64'));
        
        const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.data.url;
    } catch (error) {
        console.error('Upload failed:', error.message);
        return null;
    }
}

// Get image URL from quoted message, replied image, or profile picture
async function getImageUrl(sock, message) {
    // 1) Check for quoted image message
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        // Return buffer directly (API accepts buffer)
        return { buffer, type: 'buffer' };
    }

    // 2) Check for image in current message
    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        return { buffer, type: 'buffer' };
    }

    // 3) Get profile picture of mentioned or sender
    let targetJid;
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    if (ctx?.mentionedJid?.length > 0) {
        targetJid = ctx.mentionedJid[0];
    } else if (ctx?.participant) {
        targetJid = ctx.participant;
    } else {
        targetJid = message.key.participant || message.key.remoteJid;
    }

    try {
        const url = await sock.profilePictureUrl(targetJid, 'image');
        return { url, type: 'url' };
    } catch {
        // Default avatar if no profile picture
        return { url: 'https://i.imgur.com/2wzGhpF.png', type: 'url' };
    }
}

module.exports = {
    name: 'misc',
    alias: ['canvas', 'meme', 'img'],
    description: 'Generate meme images with avatars (heart, horny, circle, LGBT, tweet, etc.)',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        const subCommand = (args[0] || '').toLowerCase();
        const restArgs = args.slice(1);

        if (!subCommand) {
            return TmT.sendMessage(from, {
                text: `🎨 *Misc Commands*\n\n` +
                      `*Avatar Effects:*\n` +
                      `┃ .misc heart\n` +
                      `┃ .misc horny\n` +
                      `┃ .misc circle\n` +
                      `┃ .misc lgbt\n` +
                      `┃ .misc lied\n` +
                      `┃ .misc lolice\n` +
                      `┃ .misc simpcard\n` +
                      `┃ .misc tonikawa\n` +
                      `┃ .misc gay\n` +
                      `┃ .misc glass\n` +
                      `┃ .misc jail\n` +
                      `┃ .misc comrade\n` +
                      `┃ .misc passed\n` +
                      `┃ .misc triggered\n\n` +
                      `*Text + Avatar:*\n` +
                      `┃ .misc its-so-stupid <text>\n` +
                      `┃ .misc oogway <quote>\n` +
                      `┃ .misc oogway2 <quote>\n\n` +
                      `*Custom Cards:*\n` +
                      `┃ .misc namecard name|birthday|description\n` +
                      `┃ .misc tweet name|username|comment|theme\n` +
                      `┃ .misc youtube-comment username|comment\n\n` +
                      `*Usage:* Reply to an image or mention someone`
            });
        }

        await TmT.sendMessage(from, { text: '🎨 *Processing your image...*' });

        try {
            // Get the image source (quoted image, replied image, or profile pic)
            const imageSource = await getImageUrl(TmT, message);
            
            // Helper function to make API call with avatar parameter
            const makeApiCall = async (endpoint, params = {}) => {
                let avatarValue;
                if (imageSource.type === 'buffer') {
                    // For buffer, convert to base64 for API
                    avatarValue = `data:image/png;base64,${imageSource.buffer.toString('base64')}`;
                } else {
                    avatarValue = imageSource.url;
                }
                
                const urlParams = new URLSearchParams({ avatar: avatarValue, ...params });
                const url = `https://api.some-random-api.com/canvas/misc/${endpoint}?${urlParams.toString()}`;
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
                return Buffer.from(response.data);
            };

            const makeOverlayCall = async (overlay) => {
                let avatarValue;
                if (imageSource.type === 'buffer') {
                    avatarValue = `data:image/png;base64,${imageSource.buffer.toString('base64')}`;
                } else {
                    avatarValue = imageSource.url;
                }
                const url = `https://api.some-random-api.com/canvas/overlay/${overlay}?avatar=${encodeURIComponent(avatarValue)}`;
                const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
                return Buffer.from(response.data);
            };

            let resultBuffer;
            const textParam = restArgs.join(' ').trim();

            switch (subCommand) {
                // Simple avatar-only effects
                case 'heart':
                case 'horny':
                case 'circle':
                case 'lgbt':
                case 'lied':
                case 'lolice':
                case 'simpcard':
                case 'tonikawa':
                    resultBuffer = await makeApiCall(subCommand);
                    break;

                // Overlay effects
                case 'comrade':
                case 'gay':
                case 'glass':
                case 'jail':
                case 'passed':
                case 'triggered':
                    resultBuffer = await makeOverlayCall(subCommand);
                    break;

                // its-so-stupid with text
                case 'its-so-stupid':
                    if (!textParam) {
                        return TmT.sendMessage(from, { text: '❌ Usage: .misc its-so-stupid <text>' });
                    }
                    resultBuffer = await makeApiCall(subCommand, { dog: textParam });
                    break;

                // Oogway quotes
                case 'oogway':
                case 'oogway2':
                    if (!textParam) {
                        return TmT.sendMessage(from, { text: `❌ Usage: .misc ${subCommand} <quote>` });
                    }
                    resultBuffer = await makeApiCall(subCommand, { quote: textParam });
                    break;

                // Namecard: name|birthday|description
                case 'namecard': {
                    const [username, birthday, description] = textParam.split('|').map(s => s.trim());
                    if (!username || !birthday) {
                        return TmT.sendMessage(from, { text: '❌ Usage: .misc namecard name|birthday|description(optional)' });
                    }
                    const params = { username, birthday };
                    if (description) params.description = description;
                    resultBuffer = await makeApiCall(subCommand, params);
                    break;
                }

                // Tweet: name|username|comment|theme
                case 'tweet': {
                    const [displayname, username, comment, theme] = textParam.split('|').map(s => s.trim());
                    if (!displayname || !username || !comment) {
                        return TmT.sendMessage(from, { text: '❌ Usage: .misc tweet name|username|comment|theme(light/dark)' });
                    }
                    const params = { displayname, username, comment };
                    if (theme) params.theme = theme;
                    resultBuffer = await makeApiCall(subCommand, params);
                    break;
                }

                // YouTube comment: username|comment
                case 'youtube-comment': {
                    const [username, comment] = textParam.split('|').map(s => s.trim());
                    if (!username || !comment) {
                        return TmT.sendMessage(from, { text: '❌ Usage: .misc youtube-comment username|comment' });
                    }
                    resultBuffer = await makeApiCall(subCommand, { username, comment });
                    break;
                }

                default:
                    return TmT.sendMessage(from, { text: `❌ Unknown subcommand: ${subCommand}\n\nSend .misc to see all available options` });
            }

            // Send the generated image
            await TmT.sendMessage(from, {
                image: resultBuffer,
                caption: `🎨 *${subCommand}*\nGenerated with TMT-XMD-BOT`
            });

        } catch (error) {
            console.error('Misc command error:', error);
            
            if (error.response?.status === 429) {
                await TmT.sendMessage(from, { text: '❌ Rate limit reached. Please wait and try again.' });
            } else {
                await TmT.sendMessage(from, { text: '❌ Failed to generate image. Check your parameters and try again.' });
            }
        }
    }
};
