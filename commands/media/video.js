module.exports = {
    name: 'video',
    alias: ['vd', 'ytvideo'],
    description: 'Download YouTube videos',
    category: 'downloader',
    async execute(TmT, message, args, command) {
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide a YouTube URL!\nExample: !video https://youtube.com/watch?v=...' });
        }
        
        const url = args[0];
        await TmT.sendMessage(message.key.remoteJid, { text: '⏳ Downloading your video...' });
        
        try {
            const ytdl = require('ytdl-core');
            const info = await ytdl.getInfo(url);
            const format = ytdl.chooseFormat(info.formats, { quality: '18' });
            
            await TmT.sendMessage(message.key.remoteJid, {
                video: { url: format.url },
                caption: `🎬 *${info.videoDetails.title}*\n⏱️ Duration: ${info.videoDetails.lengthSeconds}s`
            });
        } catch (error) {
            await TmT.sendMessage(message.key.remoteJid, { text: '❌ Failed to download video. Check the URL.' });
        }
    }
};
