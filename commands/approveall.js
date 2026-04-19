// commands/approveall.js
module.exports = {
    name: 'approveall',
    alias: ['acceptall', 'joinall'],
    description: 'Approve all pending requests to join the group',
    category: 'group',
    adminOnly: true,
    botAdminNeeded: true,
    async execute(TmT, message, args, command, { from, isGroup, reply, react }) {

        // 1. Security Checks
        if (!isGroup) return reply('❌ This command only works in groups!');

        // 2. Fetch the list of pending requests
        await react('⏳');
        await TmT.sendMessage(from, { text: '📋 Fetching pending join requests...' });

        try {
            // --- THIS IS THE MAGIC LINE ---
            // Fetches the list of users waiting for approval
            const requests = await TmT.groupRequestParticipantsList(from);
            // -----------------------------

            if (!requests || requests.length === 0) {
                return reply('✅ No pending join requests found for this group.');
            }

            const usersToApprove = requests.map(req => req.jid);
            await reply(`👥 Found ${usersToApprove.length} pending request(s). Approving...`);

            // 3. Approve each user one by one
            let approvedCount = 0;
            let failedCount = 0;

            for (const userJid of usersToApprove) {
                try {
                    // --- THIS APPROVES THE SPECIFIC USER ---
                    await TmT.groupRequestParticipantsUpdate(from, [userJid], 'approve');
                    approvedCount++;
                    await TmT.sendMessage(from, { text: `✅ Approved @${userJid.split('@')[0]}`, mentions: [userJid] });
                } catch (err) {
                    console.error(`Failed to approve ${userJid}:`, err);
                    failedCount++;
                }
            }

            // 4. Final Report
            await react('✅');
            await reply(`🎉 *Approval Complete!*\n\n✅ Successfully Approved: ${approvedCount}\n❌ Failed: ${failedCount}`);

        } catch (error) {
            console.error(error);
            reply('❌ Failed to fetch requests. Make sure I am an admin and that "Approve Members" is turned ON in group settings.');
        }
    }
};
