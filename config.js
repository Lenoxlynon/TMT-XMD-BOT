/**
 * Global Configuration for WhatsApp MD Bot
 */

module.exports = {
    // Bot Owner Configuration
    ownerNumber: ['263713731923','27749797749'], // Add your number without + or spaces (e.g., 27749797749)
    ownerName: ['𝐓𝐌𝐓', '𝐃𝐅𝐒'], // Owner names corresponding to ownerNumber array
    module.exports = {
  // Session configuration - NOW SUPPORTS tmt~ FORMAT!
  sessionName: 'tmt_session',  // Folder name for sessions
  sessionID: process.env.SESSION_ID || 'tmt~default',  // Can be tmt~xxx or tmt~default
    // Bot Configuration
    botName: '𝐓𝐌𝐓-𝐗𝐌𝐃',
    prefix: '.',
    sessionName: 'session',
    sessionID: process.env.SESSION_ID || '',
    newsletterJid: '120363424882345646@newsletter', // Newsletter JID for menu forwarding
    updateZipUrl: 'https://github.com/Lenoxlynon/TMT-XMD-BOT/archive/refs/heads/main.zip', // URL to latest code zip for .update command
    
    // Sticker Configuration
    packname: '𝐓𝐌𝐓 𝐃𝐅𝐒',
    
    // Bot Behavior
    selfMode: false, // Private mode - only owner can use commands
    autoRead: false,
    autoTyping: false,
    autoBio: false,
    autoSticker: false,
    autoReact: false,
    autoReactMode: 'bot', // set bot or all via cmd
    autoDownload: false,
    
    // Group Settings Defaults
    defaultGroupSettings: {
      antilink: false,
      antilinkAction: 'delete', // 'delete', 'kick', 'warn'
      antitag: false,
      antitagAction: 'delete',
      antiall: false, // Owner only - blocks all messages from non-admins
      antiviewonce: false,
      antibot: false,
      anticall: false, // Anti-call feature
      antigroupmention: false, // Anti-group mention feature
      antigroupmentionAction: 'delete', // 'delete', 'kick'
      welcome: false,
      welcomeMessage: '╭═══〘 𝐍𝐄𝐖 𝐌𝐄𝐌𝐁𝐄𝐑 〙═══⊷❍\n┃✦│ᴡᴇʟᴄᴏᴍᴇ: @user 👋\n┃✦│ᴍᴇᴍʙᴇʀ ᴄᴏᴜɴᴛ: #memberCount\n┃✦│ᴛɪᴍᴇ: time⏰\n┃✦╰───────────────\n\n*@user* Welcome to *@group*! 🎉\n*Group ᴅᴇsᴛʀɪᴘᴛɪᴏɴ*\ngroupDesc\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴛᴍᴛ ʙᴏᴛ*',
      goodbye: false,
      goodbyeMessage: 'Goodbye @user 👋 We will never miss you!',
      antiSpam: false,
      antidelete: false,
      nsfw: false,
      detect: false,
      chatbot: false,
      autosticker: false // Auto-convert images/videos to stickers
    },
    
    // API Keys (add your own)
    apiKeys: {
      // Add API keys here if needed
      openai: '',
      deepai: '',
      remove_bg: ''
    },
    
    // Message Configuration
    messages: {
      wait: '🫧loading...',
      success: '🤣 Completed!',
      error: '❌ Error occurred!',
      ownerOnly: '🫧Sorry command for my owner!',
      adminOnly: '🫧🥹Sorry This command is only for group admins fam!',
      groupOnly: 'Sorry 🤣This command can only be used in groups!',
      privateOnly: '🤫 This command can only be used in private chat fam!',
      botAdminNeeded: '🔥To use 𝐓𝐌𝐓 𝐁𝐎𝐓 𝐁𝐘 𝐓𝐇𝐀𝐓 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐌𝐀𝐊𝐄 𝐌𝐄 𝐀𝐃𝐌𝐈𝐍!',
      invalidCommand: '❓ Sorry command error ! Type .menu for help'
    },
    
    // Timezone
    timezone: 'Africa/Nairobi',
    
    // Limits
    maxWarnings: 3,
    
    // Social Links (optional)
    social: {
      github: 'https://github.com/',
      instagram: 'https://instagram.com/',
      youtube: 'http://youtube.com/@'
    }
};
  
