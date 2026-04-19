const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

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
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { 
                text: '❌ Please provide a song name!\nExample: .play Shape of You' 
            });
        }

        const query = args.join(' ');
        await TmT.sendMessage(message.key.remoteJid, { 
            text: `🎵 Searching for "${query}"...` 
        });

        try {
            // Search YouTube
            const searchResults = await ytSearch(query);
            if (!searchResults.videos || searchResults.videos.length === 0) {
                return TmT.sendMessage(message.key.remoteJid, { 
                    text: '❌ No results found!' 
                });
            }

            const video = searchResults.videos[0];
            const videoUrl = video.url;

            await TmT.sendMessage(message.key.remoteJid, { 
                text: `📥 Found: ${video.title}\n⏳ Downloading...` 
            });

            // Create safe filename
            const safeTitle = video.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const audioFileName = `${safeTitle}.mp3`;
            const audioPath = path.join(tempDir, audioFileName);

            // Download audio
            const audioStream = ytdl(videoUrl, { 
                filter: 'audioonly',
                quality: 'highestaudio'
            });

            const writeStream = fs.createWriteStream(audioPath);
            await new Promise((resolve, reject) => {
                audioStream.pipe(writeStream);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            // ✅ Send AUDIO file (playable)
            await TmT.sendMessage(message.key.remoteJid, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `🎧 *${video.title}*\n⏱️ Duration: ${video.timestamp}`
            });

            // ✅ Send DOCUMENT file (downloadable)
            await TmT.sendMessage(message.key.remoteJid, {
                document: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `📄 *Saved as:* ${audioFileName}\n🎵 Song: ${video.title}`
            });

            // Clean up temp file
            fs.unlinkSync(audioPath);
            
            await TmT.sendMessage(message.key.remoteJid, { 
                text: '✅ Audio and document sent successfully!' 
            });

        } catch (error) {
            console.error('Play error:', error);
            
            if (error.statusCode === 403) {
                await TmT.sendMessage(message.key.remoteJid, { 
                    text: '❌ YouTube blocked the request. Try again later.' 
                });
            } else {
                await TmT.sendMessage(message.key.remoteJid, { 
                    text: '❌ Failed to download. Try another song.' 
                });
            }
        }
    }
};
