module.exports = {
    name: 'video',
    alias: ['vd', 'ytvideo'],
    description: 'Download video by searching song name',
    category: 'downloader',
    async execute(TmT, message, args, command) {
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide a video name!\nExample: .video Shape of You' });
        }
        
        const query = args.join(' ');
        await TmT.sendMessage(message.key.remoteJid, { text: `🔍 Searching for "${query}"...` });
        
        try {
            // FIXED: Using @distube/ytdl-core instead of ytdl-core
            const ytdl = require('@distube/ytdl-core');
            const ytSearch = require('yt-search');
            
            const searchResults = await ytSearch(query);
            
            if (!searchResults.videos || searchResults.videos.length === 0) {
                return TmT.sendMessage(message.key.remoteJid, { text: '❌ No videos found for that name!' });
            }
            
            const video = searchResults.videos[0];
            const videoUrl = video.url;
            
            await TmT.sendMessage(message.key.remoteJid, { text: `📥 Found: ${video.title}\n⏳ Downloading...` });
            
            const info = await ytdl.getInfo(videoUrl);
            
            // Find best available format
            let format = info.formats.find(f => f.hasVideo && f.hasAudio);
            if (!format) format = info.formats.find(f => f.hasVideo);
            
            await TmT.sendMessage(message.key.remoteJid, {
                video: { url: format.url },
                caption: `🎬 *${video.title}*\n⏱️ Duration: ${video.timestamp}\n👁️ Views: ${video.views || 'N/A'}`
            });
            
        } catch (error) {
            console.error('Video download error:', error);
            await TmT.sendMessage(message.key.remoteJid, { text: '❌ Failed to download video. Try another name or check your connection.' });
        }
    }
};
