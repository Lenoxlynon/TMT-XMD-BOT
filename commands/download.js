module.exports = {
    name: 'video',
    alias: ['vd', 'ytvideo'],
    description: 'Download YouTube videos',
    usage: '!video <URL>',
    category: 'downloader',
    async execute(client, message, args, cmd) {
        if (!args[0]) return message.reply('❌ Please provide a YouTube URL!\nExample: !video https://youtube.com/watch?v=...');
        
        const url = args[0];
        await message.reply('⏳ Downloading your video...');
        
        try {
            const ytdl = require('ytdl-core');
            const info = await ytdl.getInfo(url);
            const format = ytdl.chooseFormat(info.formats, { quality: '18' });
            
            await client.sendMessage(message.key.remoteJid, {
                video: { url: format.url },
                caption: `🎬 *${info.videoDetails.title}*\n⏱️ Duration: ${info.videoDetails.lengthSeconds}s`
            });
        } catch (error) {
            message.reply('❌ Failed to download video. Check the URL.');
        }
    }
};
