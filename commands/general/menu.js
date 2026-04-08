/**
 * Menu Command - Display all available commands
 */

const config = require('../../config');
const { loadCommands } = require('../../utils/commandLoader');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'menu',
  aliases: ['help', 'commands'],
  category: 'general',
  description: 'Show all available commands',
  usage: '.menu',
  
  async execute(sock, msg, args, extra) {
    try {
      // 🔥 THINKING ANIMATION - Added!
      await sock.sendPresenceUpdate('composing', extra.from);
      
      const commands = loadCommands();
      const categories = {};
      
      // Group commands by category
      commands.forEach((cmd, name) => {
        if (cmd.name === name) { // Only count main command names, not aliases
          if (!categories[cmd.category]) {
            categories[cmd.category] = [];
          }
          categories[cmd.category].push(cmd);
        }
      });
      
      const ownerNames = Array.isArray(config.ownerName) ? config.ownerName : [config.ownerName];
      const displayOwner = ownerNames[0] || config.ownerName || 'Bot Owner';
      
      let menuText = `╭═══〘 *${config.botName}* ═══⊷❍\n\n`;
      menuText += `┃✦╭────────────── @${extra.sender.split('@')[0]}!\n\n`;
      menuText += `┃✦│🫧 ᴘʀᴇғɪx: ${config.prefix}\n`;
      menuText += `┃✦│🫧 ᴄᴏᴍᴍᴀɴᴅs: ${commands.size}\n`;
      menuText += `┃✦│🫧 ᴅᴇᴠ: ${displayOwner}\n\n`;
      menuText += `┃✦╰───────────────\n`;  // ✅ Fixed: Added \n
      menuText += `╰═════════════════⊷\n\n`; // ✅ Fixed: Added \n
      
      // General Commands
      if (categories.general) {
        menuText += `╭════〘 🫧 ɢᴇɴᴇʀᴀʟ 〙═══⊷❍\n`;
        categories.general.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }
      
      // AI Commands
      if (categories.ai) {
        menuText += `\n`;
        menuText += `╭════〘 🫧 ᴀɪ 〙═══⊷❍\n`;
        categories.ai.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }
      
      // Group Commands
      if (categories.group) {
        menuText += `\n`;
        menuText += `╭════〘 🫧 ɢʀᴏᴜᴘ 〙═══⊷❍\n`;
        categories.group.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }
      
      // Admin Commands
      if (categories.admin) {
        menuText += `\n`;
        menuText += `╭════〘 🫧 ᴀᴅᴍɪɴ 〙═══⊷❍\n`;
        categories.admin.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }
      
      // Owner Commands
      if (categories.owner) {
        menuText += `\n`;
        menuText += `╭════〘 🫧 ᴏᴡɴᴇʀ 〙═══⊷❍\n`;
        categories.owner.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }
      
      // Media Commands
      if (categories.media) {
        menuText += `\n`;
        menuText += `╭════〘🫧 ᴍᴇᴅɪᴀ 〙═══⊷❍\n`;
        categories.media.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }
      
      // Fun Commands
      if (categories.fun) {
        menuText += `\n`;
        menuText += `╭════〘 🫧 ғᴜɴ 〙═══⊷❍\n`;
        categories.fun.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }
      
      // Utility Commands
      if (categories.utility) {
        menuText += `\n`;
        menuText += `╭════〘🫧 ᴜᴛɪʟɪᴛʏ 〙═══⊷❍\n`;
        categories.utility.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }

      // Anime Commands
      if (categories.anime) {
        menuText += `\n`;
        menuText += `╭════〘🫧 ᴀɴɪᴍᴇ 〙═══⊷❍\n`;
        categories.anime.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }

      // ✅ Fixed: Textmaker Commands (was duplicate utility)
      if (categories.textmaker) {
        menuText += `\n`;
        menuText += `╭════〘 🫧 ᴛᴇxᴛ ᴍᴀᴋᴇʀ 〙═══⊷❍\n`;
        categories.textmaker.forEach(cmd => {
          menuText += `┃✦│ ${config.prefix}${cmd.name}\n`;
        });
        menuText += `┃✦╰─────────────────❍\n`;
        menuText += `╰══════════════════⊷❍\n`;
      }
      
      menuText += `\n📋𝐃𝐅𝐒 𝐌𝐄𝐌𝐁𝐄𝐑\n`;
      menuText += `🫧𝐕𝐈𝐄𝐖 𝐂𝐇𝐀𝐍𝐍𝐄𝐋 & 𝐟𝐨𝐥𝐥𝐨𝐰\n`;
      
      // Stop thinking animation before sending
      await sock.sendPresenceUpdate('available', extra.from);
      
      // Send menu with image
      const imagePath = path.join(__dirname, '../../utils/bot_image.jpg');
      
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        await sock.sendMessage(extra.from, {
          image: imageBuffer,
          caption: menuText,
          mentions: [extra.sender],
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: config.newsletterJid || '120363424882345646@newsletter',
              newsletterName: config.botName,
              serverMessageId: -1
            }
          }
        }, { quoted: msg });
      } else {
        await sock.sendMessage(extra.from, {
          text: menuText,
          mentions: [extra.sender]
        }, { quoted: msg });
      }
      
    } catch (error) {
      console.error('Menu error:', error);
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};