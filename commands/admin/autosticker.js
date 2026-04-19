module.exports = {
    name: 'antisticker',
    alias: ['antistick', 'nosticker'],
    description: 'Automatically delete stickers in group (Admin only)',
    category: 'group',
    async execute(sock, msg, args, cmd, ctx) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        
        // Check if in group
        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: '❌ This command only works in groups!' });
            return;
        }
        
        try {
            // Get group metadata to check admin status
            const groupMetadata = await sock.groupMetadata(from);
            const isAdmin = groupMetadata.participants.some(
                p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
            );
            
            if (!isAdmin) {
                await sock.sendMessage(from, { text: '❌ Only group admins can use this command!' });
                return;
            }
            
            // ✅ FIXED: Correct path for database (2 levels up)
            const database = require('../../database');
            const groupSettings = database.getGroupSettings(from);
            
            if (args[0] === 'on' || args[0] === 'enable') {
                groupSettings.antisticker = true;
                database.updateGroupSettings(from, groupSettings);
                await sock.sendMessage(from, { text: '🛡️ *Anti-Sticker ENABLED*\n\nSticker messages will be deleted in this group.' });
            } 
            else if (args[0] === 'off' || args[0] === 'disable') {
                groupSettings.antisticker = false;
                database.updateGroupSettings(from, groupSettings);
                await sock.sendMessage(from, { text: '🛡️ *Anti-Sticker DISABLED*\n\nStickers will no longer be deleted.' });
            }
            else {
                const status = groupSettings.antisticker ? '✅ ENABLED' : '❌ DISABLED';
                await sock.sendMessage(from, { 
                    text: `🛡️ *Anti-Sticker Status*\n\nCurrent: ${status}\n\nTo enable: .antisticker on\nTo disable: .antisticker off` 
                });
            }
        } catch (error) {
            console.error('Anti-sticker command error:', error);
            await sock.sendMessage(from, { text: '❌ Error checking admin status. Make sure you are an admin.' });
        }
    }
};
