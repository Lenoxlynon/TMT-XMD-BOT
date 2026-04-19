module.exports = {
    name: 'antisticker',
    alias: ['antistick', 'nosticker'],
    description: 'Automatically delete stickers in group (Admin only)',
    category: 'group',
    async execute(TmT, message, args, command, { from, sender, isGroup, groupMetadata, isAdmin, reply }) {
        if (!isGroup) {
            return reply('❌ This command only works in groups!');
        }
        
        if (!isAdmin) {
            return reply('❌ Only group admins can use this command!');
        }
        
        const database = require('../database');
        const groupSettings = database.getGroupSettings(from);
        
        if (args[0] && (args[0].toLowerCase() === 'on' || args[0].toLowerCase() === 'enable')) {
            groupSettings.antisticker = true;
            database.updateGroupSettings(from, groupSettings);
            return reply('🛡️ *Anti-Sticker ENABLED*\n\nSticker messages will automatically be deleted in this group.');
        } 
        else if (args[0] && (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'disable')) {
            groupSettings.antisticker = false;
            database.updateGroupSettings(from, groupSettings);
            return reply('🛡️ *Anti-Sticker DISABLED*\n\nStickers will no longer be deleted.');
        }
        
        const status = groupSettings.antisticker ? '✅ ENABLED' : '❌ DISABLED';
        reply(`🛡️ *Anti-Sticker Status*\n\nCurrent: ${status}\n\nTo enable: .antisticker on\nTo disable: .antisticker off`);
    }
};
