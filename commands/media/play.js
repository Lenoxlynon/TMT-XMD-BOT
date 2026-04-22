const fs = require('fs');
const path = require('path');
const ytSearch = require('yt-search');

// Create temp folder if it doesn't exist
const tempDir = path.join(__dirname, '..', '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

module.exports = {
    name: 'play',
    alias: ['music', 'song', 'ytmp3'],
    description: 'Download music as audio + document file',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        
        if (!args[0]) {
            return TmT.sendMessage(from, { text: '❌ Please provide a song name!\nExample: .play Shape of You' });
        }

        const query = args.join(' ');
        await TmT.sendMessage(from, { text: `🎵 Searching for "${query}"...` });

        try {
            // Search for the video on YouTube
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return TmT.sendMessage(from, { text: '❌ No results found!' });
            }

            const video = searchResults.videos[0];
            const videoUrl = video.url;

            await TmT.sendMessage(from, { text: `📥 Found: ${video.title}\n⏳ Downloading audio...` });

            // Create safe filename
            const safeTitle = video.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const audioFileName = `${safeTitle}.mp3`;
            const audioPath = path.join(tempDir, audioFileName);

            // ✅ FIX: Use dynamic import for the latest ytdl-core fork
            const { default: ytdl } = await import('@ybd-project/ytdl-core');
            
            // Download with retry logic for 403 errors
            let downloadSuccess = false;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (!downloadSuccess && retryCount < maxRetries) {
                try {
                    const audioStream = ytdl(videoUrl, {
                        filter: 'audioonly',
                        quality: 'highestaudio',
                        requestOptions: {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            }
                        }
                    });
                    
                    const writeStream = fs.createWriteStream(audioPath);
                    await new Promise((resolve, reject) => {
                        audioStream.pipe(writeStream);
                        writeStream.on('finish', resolve);
                        writeStream.on('error', reject);
                        audioStream.on('error', reject);
                    });
                    
                    downloadSuccess = true;
                } catch (err) {
                    retryCount++;
                    console.log(`Retry ${retryCount}/${maxRetries} for ${video.title}`);
                    if (retryCount >= maxRetries) throw err;
                    await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds before retry
                }
            }

            // Send audio file
            await TmT.sendMessage(from, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `🎧 *${video.title}*\n⏱️ Duration: ${video.timestamp}`
            });

            // Send document file
            await TmT.sendMessage(from, {
                document: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `📄 *Saved as:* ${audioFileName}\n🎵 Song: ${video.title}`
            });

            // Clean up
            fs.unlinkSync(audioPath);
            await TmT.sendMessage(from, { text: '✅ Audio and document sent successfully!' });

        } catch (error) {
            console.error('Play command error:', error);
            
            if (error.statusCode === 429) {
                await TmT.sendMessage(from, { text: '❌ YouTube is rate-limiting us. Please wait a moment and try again.' });
            } else if (error.message && error.message.includes('403')) {
                await TmT.sendMessage(from, { text: '❌ YouTube is blocking this request. Try a different song or try again later.' });
            } else {
                await TmT.sendMessage(from, { text: `❌ Failed to download. Try another song.` });
            }
        }
    }
};
