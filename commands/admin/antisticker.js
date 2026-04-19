module.exports = {
    name: 'antisticker',
    alias: ['antistick', 'nosticker'],
    description: 'Automatically delete stickers in group (Admin only)',
    category: 'group',
    async execute(TmT, message, args, command, context) {
        // Get values from context or from parameters
        const from = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        // Check if in group
        if (!isGroup) {
            return TmT.sendMessage(from, { text: '❌ This command only works in groups!' });
        }
        
        // Get group metadata to check admin status
        const groupMetadata = await TmT.groupMetadata(from);
        const isAdmin = groupMetadata.participants.some(
            p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        
        if (!isAdmin) {
            return TmT.sendMessage(from, { text: '❌ Only group admins can use this command!' });
        }
        
        const database = require('../database');
        const groupSettings = database.getGroupSettings(from);
        
        if (args[0] && (args[0].toLowerCase() === 'on' || args[0].toLowerCase() === 'enable')) {
            groupSettings.antisticker = true;
            database.updateGroupSettings(from, groupSettings);
            return TmT.sendMessage(from, { text: '🛡️ *Anti-Sticker ENABLED*\n\nSticker messages will automatically be deleted in this group.' });
        } 
        else if (args[0] && (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'disable')) {
            groupSettings.antisticker = false;
            database.updateGroupSettings(from, groupSettings);
            return TmT.sendMessage(from, { text: '🛡️ *Anti-Sticker DISABLED*\n\nStickers will no longer be deleted.' });
        }
        
        const status = groupSettings.antisticker ? '✅ ENABLED' : '❌ DISABLED';
        return TmT.sendMessage(from, { 
            text: `🛡️ *Anti-Sticker Status*\n\nCurrent: ${status}\n\nTo enable: .antisticker on\nTo disable: .antisticker off` 
        });
    }
};
