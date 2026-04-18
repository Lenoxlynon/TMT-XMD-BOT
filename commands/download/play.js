const fs = require('fs');
const path = require('path');

// Create temp folder if it doesn't exist
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

module.exports = {
    name: 'play',
    alias: ['music', 'song'],
    description: 'Download music as audio + document file',
    category: 'music',
    async execute(TmT, message, args, command) {
        // CHECK: Make sure user provided a song name
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide a song name!\nExample: .play Shape of You' });
        }
        
        // Get the search query
        const query = args.join(' ');
        
        // Send searching message
        await TmT.sendMessage(message.key.remoteJid, { text: `🎵 Searching for "${query}"...` });
        
        try {
            // Import required libraries
            const ytdl = require('ytdl-core');
            const ytSearch = require('yt-search');
            
            // Search YouTube for the song
            const searchResults = await ytSearch(query);
            
            // CHECK: Make sure we found something
            if (!searchResults.videos || searchResults.videos.length === 0) {
                return TmT.sendMessage(message.key.remoteJid, { text: '❌ No results found!' });
            }
            
            // Get the first search result
            const video = searchResults.videos[0];
            const videoUrl = video.url;
            
            // Update status
            await TmT.sendMessage(message.key.remoteJid, { text: `📥 Found: ${video.title}\n⏳ Downloading audio...` });
            
            // Get video info
            const info = await ytdl.getInfo(videoUrl);
            
            // Create a safe filename (remove special characters)
            const safeTitle = video.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const audioFileName = `${safeTitle}.mp3`;
            const audioPath = path.join(__dirname, '..', 'temp', audioFileName);
            
            // Download audio as MP3
            const audioStream = ytdl(videoUrl, { 
                filter: 'audioonly',
                quality: 'highestaudio'
            });
            
            // Save audio to file
            const writeStream = fs.createWriteStream(audioPath);
            await new Promise((resolve, reject) => {
                audioStream.pipe(writeStream);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
                audioStream.on('error', reject);
            });
            
            // Send audio file
            await TmT.sendMessage(message.key.remoteJid, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `🎧 *${video.title}*\n⏱️ Duration: ${video.timestamp}\n👁️ Views: ${video.views || 'N/A'}`
            });
            
            // Send document file
            await TmT.sendMessage(message.key.remoteJid, {
                document: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `📄 *Document saved:* ${audioFileName}\n🎵 Song: ${video.title}\n🔗 Source: ${videoUrl}`
            });
            
            // Clean up - delete the temporary file
            fs.unlinkSync(audioPath);
            
            await TmT.sendMessage(message.key.remoteJid, { text: '✅ Audio and document sent successfully!' });
            
        } catch (error) {
            console.error('Music download error:', error);
            await TmT.sendMessage(message.key.remoteJid, { text: '❌ Failed to download music. Try another song name.' });
        }
    }
};
