module.exports = {
    name: 'video',
    alias: ['vd', 'ytvideo'],
    description: 'Download video by searching song name',
    category: 'downloader',
    async execute(TmT, message, args, command) {
        // CHECK 1: Make sure user provided a search query
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide a video name!\nExample: .video Shape of You' });
        }
        
        // Get the search query (everything user typed)
        const query = args.join(' ');
        
        // Send searching message
        await TmT.sendMessage(message.key.remoteJid, { text: `🔍 Searching for "${query}"...` });
        
        try {
            // Import required libraries
            const ytdl = require('ytdl-core');
            const ytSearch = require('yt-search');
            
            // Search YouTube for the video
            const searchResults = await ytSearch(query);
            
            // CHECK 2: Make sure we found something
            if (!searchResults.videos || searchResults.videos.length === 0) {
                return TmT.sendMessage(message.key.remoteJid, { text: '❌ No videos found for that name!' });
            }
            
            // Get the first search result
            const video = searchResults.videos[0];
            const videoUrl = video.url;
            
            // Update status message
            await TmT.sendMessage(message.key.remoteJid, { text: `📥 Found: ${video.title}\n⏳ Downloading...` });
            
            // Get video info from YouTube
            const info = await ytdl.getInfo(videoUrl);
            
            // Choose video format (quality 18 = 360p)
            let format = ytdl.chooseFormat(info.formats, { quality: '18' });
            if (!format) {
                format = ytdl.chooseFormat(info.formats, { quality: 'lowest' });
            }
            
            // Send the video
            await TmT.sendMessage(message.key.remoteJid, {
                video: { url: format.url },
                caption: `🎬 *${video.title}*\n⏱️ Duration: ${video.timestamp}\n👁️ Views: ${video.views || 'N/A'}\n🔗 ${videoUrl}`
            });
            
        } catch (error) {
            console.error('Video download error:', error);
            
            // Handle specific errors
            if (error.message.includes('private') || error.message.includes('age')) {
                await TmT.sendMessage(message.key.remoteJid, { text: '❌ This video is private or age-restricted.' });
            } else {
                await TmT.sendMessage(message.key.remoteJid, { text: '❌ Failed to download video. Try another name or check your connection.' });
            }
        }
    }
};
