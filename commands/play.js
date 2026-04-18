module.exports = {
    name: 'play',
    alias: ['music', 'song'],
    description: 'Play music from YouTube',
    usage: '!play <song name>',
    category: 'music',
    async execute(client, message, args, cmd) {
        if (!args[0]) return message.reply('❌ Please provide a song name!\nExample: !play Shape of You');
        
        const query = args.join(' ');
        await message.reply(`🎵 Searching for "${query}"...`);
        
        try {
            const ytdl = require('ytdl-core');
            const ytSearch = require('yt-search');
            
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) return message.reply('❌ No results found!');
            
            const video = searchResults.videos[0];
            const audioStream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
            
            await client.sendMessage(message.key.remoteJid, {
                audio: { stream: audioStream },
                mimetype: 'audio/mpeg',
                fileName: `${video.title}.mp3`,
                caption: `🎧 *Now Playing:* ${video.title}\n⏱️ Duration: ${video.timestamp}`
            });
        } catch (error) {
            message.reply('❌ Music playback failed. Try again later.');
        }
    }
};
