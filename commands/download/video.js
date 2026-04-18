module.exports = {
    name: 'video',
    alias: ['vd', 'ytvideo', 'playvideo'],
    description: 'Download video from YouTube or other platforms',
    usage: '!video <URL>',
    category: 'downloader',
    async execute(client, message, args, cmd) {
        if (!args[0]) {
            return message.reply('❌ Please provide a video URL!\nExample: !video https://youtube.com/watch?v=...');
        }
        
        const url = args[0];
        await message.reply('⏳ Downloading your video...');
        
        try {
            // For YouTube videos
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                // Using ytdl-core (make sure it's in package.json)
                const ytdl = require('ytdl-core');
                const info = await ytdl.getInfo(url);
                const format = ytdl.chooseFormat(info.formats, { quality: '18' }); // 360p mp4
                
                await client.sendMessage(message.key.remoteJid, {
                    video: { url: format.url },
                    caption: `🎬 *${info.videoDetails.title}*\n⏱️ Duration: ${info.videoDetails.lengthSeconds}s`
                });
            } else {
                // For other platforms (Twitter, Instagram, TikTok)
                // You'll need APIs like: https://p.oceansaver.in/download
                const response = await fetch(`https://your-api.com/download?url=${encodeURIComponent(url)}`);
                const data = await response.json();
                
                if (data.video_url) {
                    await client.sendMessage(message.key.remoteJid, {
                        video: { url: data.video_url },
                        caption: '✅ Video downloaded!'
                    });
                }
            }
        } catch (error) {
            await message.reply('❌ Failed to download video. Check the URL or try again later.');
            console.error(error);
        }
    }
};
