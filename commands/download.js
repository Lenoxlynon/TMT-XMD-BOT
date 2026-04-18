module.exports = {
    name: 'video',
    alias: ['vd', 'ytvideo'],
    description: 'Download YouTube videos',
    category: 'downloader',
    async execute(TmT, message, args, command) {
        // CHECK 1: Make sure user provided a URL
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide a YouTube URL!\nExample: !video https://youtube.com/watch?v=...' });
        }
        
        // CHECK 2: Clean the URL (remove spaces and line breaks)
        let url = args[0].trim();
        
        // CHECK 3: Basic YouTube URL validation
        if (!url.includes('youtube.com/watch?v=') && !url.includes('youtu.be/')) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide a valid YouTube URL.' });
        }
        
        // Send "downloading" message
        await TmT.sendMessage(message.key.remoteJid, { text: '⏳ Downloading your video...' });
        
        // CHECK 4: Try to download the video
        try {
            const ytdl = require('ytdl-core');
            
            // Validate URL with ytdl-core
            if (!ytdl.validateURL(url)) {
                return TmT.sendMessage(message.key.remoteJid, { text: '❌ Invalid YouTube URL.' });
            }
            
            // Get video information
            const info = await ytdl.getInfo(url);
            
            // Choose video format (quality 18 = 360p)
            let format = ytdl.chooseFormat(info.formats, { quality: '18' });
            if (!format) {
                format = ytdl.chooseFormat(info.formats, { quality: 'lowest' });
            }
            
            // Send the video
            await TmT.sendMessage(message.key.remoteJid, {
                video: { url: format.url },
                caption: `🎬 *${info.videoDetails.title}*\n⏱️ Duration: ${info.videoDetails.lengthSeconds}s`
            });
            
        } catch (error) {
            console.error('Video download error:', error);
            
            // Handle specific errors
            if (error.message.includes('private') || error.message.includes('age')) {
                await TmT.sendMessage(message.key.remoteJid, { text: '❌ This video is private or age-restricted.' });
            } else {
                await TmT.sendMessage(message.key.remoteJid, { text: '❌ Failed to download video. The video might be too long or restricted.' });
            }
        }
    }
};
