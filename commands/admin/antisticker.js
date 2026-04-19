// Anti-sticker feature for groups
// When enabled, automatically deletes any sticker messages

// Store enabled groups in memory
const antiStickerGroups = new Set();

module.exports = {
    name: 'antisticker',
    alias: ['antistick', 'nosticker'],
    description: 'Automatically delete stickers in group (Admin only)',
    category: 'group',
    async execute(TmT, message, args, command) {
        // Check if in a group
        if (!message.key.remoteJid.endsWith('@g.us')) {
            return TmT.sendMessage(message.key.remoteJid, { 
                text: '❌ This command only works in groups!' 
            });
        }
        
        // Check if user is admin
        const groupMetadata = await TmT.groupMetadata(message.key.remoteJid);
        const sender = message.key.participant || message.key.remoteJid;
        const isAdmin = groupMetadata.participants.some(
            p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        
        if (!isAdmin) {
            return TmT.sendMessage(message.key.remoteJid, { 
                text: '❌ Only group admins can use this command!' 
            });
        }
        
        const groupId = message.key.remoteJid;
        
        // Check current status
        const isEnabled = antiStickerGroups.has(groupId);
        
        // Toggle or set status based on args
        let newStatus;
        if (args[0] && (args[0].toLowerCase() === 'on' || args[0].toLowerCase() === 'enable')) {
            antiStickerGroups.add(groupId);
            newStatus = true;
        } else if (args[0] && (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'disable')) {
            antiStickerGroups.delete(groupId);
            newStatus = false;
        } else {
            // Just show status if no argument
            return TmT.sendMessage(message.key.remoteJid, {
                text: `🛡️ *Anti-Sticker Status*\n\n` +
                      `Current: ${isEnabled ? '✅ ENABLED' : '❌ DISABLED'}\n\n` +
                      `To enable: .antisticker on\n` +
                      `To disable: .antisticker off`
            });
        }
        
        await TmT.sendMessage(message.key.remoteJid, {
            text: `🛡️ *Anti-Sticker ${newStatus ? 'ENABLED' : 'DISABLED'}*\n\n` +
                  `Sticker messages will ${newStatus ? 'automatically be deleted' : 'no longer be deleted'} in this group.`
        });
    },
    
    // This function will be called for every message
    async onMessage(TmT, message) {
        // Check if message is a sticker
        const isSticker = message.message?.stickerMessage || 
                         message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
        
        if (!isSticker) return;
        
        const groupId = message.key.remoteJid;
        
        // Check if anti-sticker is enabled for this group
        if (!antiStickerGroups.has(groupId)) return;
        
        // Check if sender is admin (don't delete admin stickers)
        try {
            const groupMetadata = await TmT.groupMetadata(groupId);
            const sender = message.key.participant || message.key.remoteJid;
            const isAdmin = groupMetadata.participants.some(
                p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin')
            );
            
            if (isAdmin) return; // Skip deletion for admins
        } catch (error) {
            console.error('Error checking admin status:', error);
        }
        
        // Delete the sticker message
        try {
            await TmT.sendMessage(groupId, {
                delete: {
                    remoteJid: groupId,
                    fromMe: false,
                    id: message.key.id,
                    participant: message.key.participant || message.key.remoteJid
                }
            });
            
            // Optional: Send warning message (can be commented out)
            // await TmT.sendMessage(groupId, {
            //     text: `⚠️ Sticker deleted! This group has anti-sticker enabled.`,
            //     edit: message.key
            // });
            
        } catch (error) {
            console.error('Failed to delete sticker:', error);
        }
    }
};
