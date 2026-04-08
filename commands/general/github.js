/**
 * GitHub Command - Show bot GitHub repository and stats
 */

const axios = require('axios');
const config = require('../../config');

module.exports = {
    name: 'github',
    aliases: ['repo', 'git', 'source', 'sc', 'script'],
    category: 'general',
    description: 'Show bot GitHub repository and statistics',
    usage: '.github',
    ownerOnly: false,

    async execute(sock, msg, args, extra) {
        try {
            const chatId = extra.from;
            
            // GitHub repository URL
            const repoUrl = 'https://github.com/Lenoxlynon/TMT-XMD-BOT';
            const apiUrl = 'https://api.github.com/repos/Lenoxlynon/TMT-XMD-BOT';
            
            // Send loading message
            const loadingMsg = await extra.reply('🔍 𝐓𝐌𝐓 Repo loading Fork...');
            
            try {
                // Fetch repository data from GitHub API
                const response = await axios.get(apiUrl, {
                    headers: {
                        'User-Agent': '𝐓𝐌𝐓-𝐗𝐌𝐃'
                    }
                });
                
                const repo = response.data;
                
                // Format the response with proper styling
                let message = `╭═══〘 𝐓𝐌𝐓-𝐗𝐌𝐃 〙═══⊷❍\n\n`;
                message += `┃✦╭──────────────\n`;
                message += `┃✦│🔗 *ʀᴇᴘᴏ:* ${repo.name}\n`;
                message += `┃✦│👨‍💻 *ᴏᴡɴᴇʀ:* ${repo.owner.login}\n`;
                message += `┃✦│📄 *ᴅᴇsᴛʀɪᴘᴛɪᴏɴ:* ${repo.description || 'No description provided'}\n`;
                message += `┃✦│🌐 *ᴜʀʟ:* ${repo.html_url}\n\n`;
                
                message += `┃✦│📊 *ʀᴇᴘᴏ sᴛᴀᴛs*\n`;
                message += `┃✦│⭐ *sᴛᴀʀs:* ${repo.stargazers_count.toLocaleString()}\n`;
                message += `┃✦│🍴 *ғᴏʀᴋs:* ${repo.forks_count.toLocaleString()}\n`;
                message += `┃✦│👁️ *ᴡᴀᴛᴄʜᴇʀs:* ${repo.watchers_count.toLocaleString()}\n`;
                message += `┃✦│📦 *sɪᴢᴇ:* ${(repo.size / 1024).toFixed(2)} MB\n\n`;
                
                message += `┃✦│🔗 *ǫᴜɪᴄᴋ ʟɪɴᴋ*\n`; // ✅ Fixed: Added missing +
                message += `┃✦╰───────────────\n\n`;
                message += `╰═════════════════⊷\n\n`;
                message += `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${config.botName}*`;
                
                // Edit the loading message with the actual data
                if (loadingMsg && loadingMsg.key) {
                    await sock.sendMessage(chatId, {
                        text: message,
                        edit: loadingMsg.key
                    });
                } else {
                    await extra.reply(message);
                }
                
            } catch (apiError) {
                // Fallback message if API fails
                console.error('GitHub API Error:', apiError.message);
                
                let fallbackMessage = `╭═══〘 *ʀᴇᴘᴏ* 〙═══⊷❍\n\n`;
                fallbackMessage += `┃✦│🤖 *ʙᴏᴛ ɴᴀᴍᴇ:* ${config.botName}\n`;
                fallbackMessage += `┃✦│🔗 *ʀᴇᴘᴏ:* 𝐓𝐌𝐓-𝐗𝐌𝐃\n`;
                fallbackMessage += `┃✦│👨‍💻 *ᴏᴡɴᴇʀ:* 𝐓𝐌𝐓\n`;
                fallbackMessage += `┃✦│🌐 *URL:* ${repoUrl}\n\n`;
                fallbackMessage += `⚠️ *Note:* Unable to fetch real-time statistics.\n`;
                fallbackMessage += `Please visit the repository directly for latest stats.\n\n`;
                fallbackMessage += `┃✦╰───────────────\n\n`;
                fallbackMessage += `╰═════════════════⊷\n\n`;
                fallbackMessage += `> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${config.botName}*`;
                
                if (loadingMsg && loadingMsg.key) {
                    await sock.sendMessage(chatId, {
                        text: fallbackMessage,
                        edit: loadingMsg.key
                    });
                } else {
                    await extra.reply(fallbackMessage);
                }
            }
            
        } catch (error) {
            console.error('GitHub command error:', error);
            await extra.reply(`❌ Error: ${error.message}`);
        }
    }
};