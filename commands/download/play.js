module.exports = {
    name: 'play',
    alias: ['music', 'song', 'ytmusic'],
    description: 'Play music from YouTube',
    usage: '!play <song name or URL>',
    category: 'music',
    async execute(client, message, args, cmd) {
        if (!args[0]) {
            return message.reply('❌ Please provide a song name or URL!\nExample: !play Shape of You');
        }
        
        const query = args.join(' ');
        await message.reply(`🎵 Searching for "${query}"...`);
        
        try {
            // Option 1: Using ytdl-core for direct audio
            const ytdl = require('ytdl-core');
            const ytSearch = require('yt-search');
            
            // Search YouTube
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return message.reply('❌ No results found!');
            }
            
            const video = searchResults.videos[0];
            const audioStream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
            
            // Send as audio file
            await client.sendMessage(message.key.remoteJid, {
                audio: { stream: audioStream },
                mimetype: 'audio/mpeg',
                fileName: `${video.title}.mp3`,
                caption: `🎧 *Now Playing:* ${video.title}\n⏱️ Duration: ${video.timestamp}\n🔗 ${video.url}`
            });
            
        } catch (error) {
            // Option 2: Fallback to direct YouTube link if audio fails
            try {
                const ytSearch = require('yt-search');
                const searchResults = await ytSearch(query);
                const video = searchResults.videos[0];
                
                await client.sendMessage(message.key.remoteJid, {
                    text: `🎵 *${video.title}*\n⏱️ ${video.timestamp}\n📥 Download: ${video.url}\n\n⚠️ Send .mp3 directly failed. Use the link to download.`
                });
            } catch (error2) {
                await message.reply('❌ Music playback failed. Please try again later.');
                console.error(error2);
            }
        }
    }
};
