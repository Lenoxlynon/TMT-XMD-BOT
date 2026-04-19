// commands/restart.js - Simple version (no API needed)
module.exports = {
    name: 'restart',
    alias: ['reboot'],
    description: 'Reload commands without restart (Owner only)',
    category: 'owner',
    ownerOnly: true,
    async execute(sock, msg, args, cmd, ctx) {
        const from = msg.key.remoteJid;
        
        await sock.sendMessage(from, { text: '🔄 Reloading commands...' });
        
        // Trigger reload from index.js
        if (global.reloadCommands) {
            await global.reloadCommands(sock, from);
        } else {
            await sock.sendMessage(from, { text: '❌ Reload function not available. Use .reload command instead.' });
        }
    }
};
