module.exports = {
    name: 'play',
    alias: ['music', 'song'],
    description: 'Play music from YouTube',
    category: 'music',
    async execute(TmT, message, args, command) {
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide a song name!\nExample: !play Shape of You' });
        }
        
        const query = args.join(' ');
        await TmT.sendMessage(message.key.remoteJid, { text: `🎵 Searching for "${query}"...` });
        
        try {
            const ytdl = require('ytdl-core');
            const ytSearch = require('yt-search');
            
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return TmT.sendMessage(message.key.remoteJid, { text: '❌ No results found!' });
            }
            
            const video = searchResults.videos[0];
            const audioStream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
            
            await TmT.sendMessage(message.key.remoteJid, {
                audio: { stream: audioStream },
                mimetype: 'audio/mpeg',
                fileName: `${video.title}.mp3`,
                caption: `🎧 *Now Playing:* ${video.title}\n⏱️ Duration: ${video.timestamp}`
            });
        } catch (error) {
            await TmT.sendMessage(message.key.remoteJid, { text: '❌ Music playback failed. Try again later.' });
        }
    }
};
