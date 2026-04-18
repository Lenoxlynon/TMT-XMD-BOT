module.exports = {
    name: 'approve',
    alias: ['accept'],
    description: 'Approve a pending join request by mentioning the user',
    category: 'group',
    async execute(TmT, message, args, command) {
        // Check if in a group
        if (!message.key.remoteJid.endsWith('@g.us')) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ This command only works in groups!' });
        }
        
        // Check if user is admin
        const groupMetadata = await TmT.groupMetadata(message.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(
            p => p.id === message.key.participant && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        
        if (!isAdmin) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Only group admins can use this command!' });
        }
        
        // Get mentioned user or number from args
        let userToApprove = null;
        
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
            userToApprove = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (args[0]) {
            // Check if args[0] looks like a phone number
            const phoneNumber = args[0].replace(/[^0-9]/g, '');
            if (phoneNumber.length >= 10) {
                userToApprove = `${phoneNumber}@s.whatsapp.net`;
            }
        }
        
        if (!userToApprove) {
            return TmT.sendMessage(message.key.remoteJid, { 
                text: '❌ Please mention the user you want to approve!\nExample: .approve @username' 
            });
        }
        
        try {
            // Try to add the user to the group
            await TmT.groupParticipantsUpdate(
                message.key.remoteJid,
                [userToApprove],
                'add'
            );
            
            await TmT.sendMessage(message.key.remoteJid, { 
                text: `✅ User has been approved and added to the group!` 
            });
        } catch (error) {
            console.error('Approval error:', error);
            
            if (error.message?.includes('not found')) {
                await TmT.sendMessage(message.key.remoteJid, { 
                    text: '❌ User not found or hasn\'t requested to join yet.' 
                });
            } else {
                await TmT.sendMessage(message.key.remoteJid, { 
                    text: '❌ Failed to approve user. Make sure they have a pending request.' 
                });
            }
        }
    }
};
