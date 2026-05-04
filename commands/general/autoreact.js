// commands/general/autoreact.js
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../../config.js');

module.exports = {
    name: 'autoreact',
    alias: ['react', 'autoreact'],
    description: 'Toggle auto-reaction feature (Owner only)',
    category: 'owner',
    ownerOnly: true,
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        
        // Read current config
        let configContent = fs.readFileSync(configPath, 'utf8');
        
        if (args[0] && (args[0].toLowerCase() === 'on' || args[0].toLowerCase() === 'enable')) {
            // Enable auto-react
            if (configContent.includes('autoReact: false')) {
                configContent = configContent.replace('autoReact: false', 'autoReact: true');
                fs.writeFileSync(configPath, configContent);
                return TmT.sendMessage(from, { text: '✅ *Auto-Reaction ENABLED*\n\nBot will react to messages with random emojis.' });
            } else {
                return TmT.sendMessage(from, { text: '⚠️ Auto-reaction is already enabled.' });
            }
        } 
        else if (args[0] && (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'disable')) {
            // Disable auto-react
            if (configContent.includes('autoReact: true')) {
                configContent = configContent.replace('autoReact: true', 'autoReact: false');
                fs.writeFileSync(configPath, configContent);
                return TmT.sendMessage(from, { text: '❌ *Auto-Reaction DISABLED*\n\nBot will no longer react to messages.' });
            } else {
                return TmT.sendMessage(from, { text: '⚠️ Auto-reaction is already disabled.' });
            }
        }
        
        // Show current status
        const isEnabled = configContent.includes('autoReact: true');
        const currentMode = configContent.match(/autoReactMode:\s*'(\w+)'/)?.[1] || 'bot';
        
        return TmT.sendMessage(from, { 
            text: `⚙️ *Auto-Reaction Status*\n\n` +
                  `Enabled: ${isEnabled ? '✅ YES' : '❌ NO'}\n` +
                  `Mode: ${currentMode}\n\n` +
                  `To enable: .autoreact on\n` +
                  `To disable: .autoreact off\n` +
                  `To change mode: Edit autoReactMode in config.js\n\n` +
                  `Modes:\n` +
                  `• 'bot' - Reacts only to commands\n` +
                  `• 'all' - Reacts to all messages`
        });
    }
};
