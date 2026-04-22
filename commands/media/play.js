const fs = require('fs');
const path = require('path');
const ytSearch = require('yt-search');

// Create temp folder
const tempDir = path.join(__dirname, '..', '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Helper function to delay between retries
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            // Search YouTube
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return TmT.sendMessage(from, { text: '❌ No results found!' });
            }

            const video = searchResults.videos[0];
            const videoUrl = video.url;

            await TmT.sendMessage(from, { text: `📥 Found: ${video.title}\n⏳ Downloading audio...` });

            const safeTitle = video.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const audioFileName = `${safeTitle}.mp3`;
            const audioPath = path.join(tempDir, audioFileName);

            // Try multiple download methods with retries
            let downloadSuccess = false;
            let lastError = null;
            
            // Method 1: Try with standard settings (3 retries)
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const { default: ytdl } = await import('@ybd-project/ytdl-core');
                    
                    const audioStream = ytdl(videoUrl, {
                        filter: 'audioonly',
                        quality: 'highestaudio',
                        requestOptions: {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.5',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'Connection': 'keep-alive',
                                'Sec-Fetch-Dest': 'document',
                                'Sec-Fetch-Mode': 'navigate',
                                'Sec-Fetch-Site': 'none',
                                'Upgrade-Insecure-Requests': '1'
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
                    break;
                } catch (err) {
                    lastError = err;
                    console.log(`Attempt ${attempt} failed: ${err.message}`);
                    if (attempt < 3) await delay(3000);
                }
            }
            
            // Method 2: If still failing, try with lower quality
            if (!downloadSuccess) {
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        const { default: ytdl } = await import('@ybd-project/ytdl-core');
                        
                        const audioStream = ytdl(videoUrl, {
                            filter: 'audioonly',
                            quality: 'lowestaudio',
                            requestOptions: {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
                        break;
                    } catch (err) {
                        lastError = err;
                        console.log(`Low quality attempt ${attempt} failed`);
                        if (attempt < 2) await delay(3000);
                    }
                }
            }
            
            if (!downloadSuccess) {
                throw lastError || new Error('All download methods failed');
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

            fs.unlinkSync(audioPath);
            await TmT.sendMessage(from, { text: '✅ Audio and document sent successfully!' });

        } catch (error) {
            console.error('Play command error:', error);
            
            // Check for specific error types [citation:9]
            if (error.message?.includes('429') || error.statusCode === 429) {
                await TmT.sendMessage(from, { text: '❌ YouTube rate limit reached. Please wait a few minutes and try again.' });
            } else if (error.message?.includes('403') || error.statusCode === 403) {
                await TmT.sendMessage(from, { text: '❌ YouTube is blocking this request. This usually resolves within 24 hours. Try again later.' });
            } else if (error.message?.includes('private')) {
                await TmT.sendMessage(from, { text: '❌ This video is private or age-restricted.' });
            } else {
                await TmT.sendMessage(from, { text: `❌ Failed to download. Try another song or try again later.` });
            }
        }
    }
};
