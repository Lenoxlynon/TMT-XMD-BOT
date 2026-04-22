const fs = require('fs');
const path = require('path');
const ytSearch = require('yt-search');

const tempDir = path.join(__dirname, '..', '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Try multiple player clients (some may work when others fail)
const PLAYER_CLIENTS = [
    "IOS",
    "WEB_CREATOR",
    "ANDROID",
    "WEB"
];

module.exports = {
    name: 'video',
    alias: ['vd', 'ytvideo', 'mp4'],
    description: 'Download video by searching name',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        
        if (!args[0]) {
            return TmT.sendMessage(from, { text: '❌ Please provide a video name!\nExample: .video Shape of You' });
        }

        const query = args.join(' ');
        await TmT.sendMessage(from, { text: `🔍 Searching for "${query}"...` });

        try {
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return TmT.sendMessage(from, { text: '❌ No videos found!' });
            }

            const video = searchResults.videos[0];
            const videoUrl = video.url;

            await TmT.sendMessage(from, { text: `📥 Found: ${video.title}\n⏳ Downloading video...` });

            const safeTitle = video.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const videoFileName = `${safeTitle}.mp4`;
            const videoPath = path.join(tempDir, videoFileName);

            let downloadSuccess = false;
            let lastError = null;

            // Method 1: Try with different player clients (this helps bypass 403)
            for (const client of PLAYER_CLIENTS) {
                if (downloadSuccess) break;
                
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        const { default: ytdl } = await import('@ybd-project/ytdl-core');
                        
                        const videoStream = ytdl(videoUrl, {
                            quality: '18',
                            playerClients: [client],
                            requestOptions: {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                }
                            }
                        });
                        
                        const writeStream = fs.createWriteStream(videoPath);
                        await new Promise((resolve, reject) => {
                            videoStream.pipe(writeStream);
                            writeStream.on('finish', resolve);
                            writeStream.on('error', reject);
                            videoStream.on('error', reject);
                        });
                        
                        downloadSuccess = true;
                        break;
                    } catch (err) {
                        lastError = err;
                        console.log(`Client ${client} attempt ${attempt} failed: ${err.message}`);
                        if (attempt < 2) await delay(2000);
                    }
                }
            }

            // Method 2: Try without playerClients if all failed
            if (!downloadSuccess) {
                try {
                    const { default: ytdl } = await import('@ybd-project/ytdl-core');
                    
                    const videoStream = ytdl(videoUrl, {
                        quality: '18',
                        requestOptions: {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            }
                        }
                    });
                    
                    const writeStream = fs.createWriteStream(videoPath);
                    await new Promise((resolve, reject) => {
                        videoStream.pipe(writeStream);
                        writeStream.on('finish', resolve);
                        writeStream.on('error', reject);
                        videoStream.on('error', reject);
                    });
                    
                    downloadSuccess = true;
                } catch (err) {
                    lastError = err;
                    console.log(`Fallback method failed: ${err.message}`);
                }
            }

            if (!downloadSuccess) {
                throw lastError || new Error('All download methods failed');
            }

            await TmT.sendMessage(from, {
                video: { url: videoPath },
                caption: `🎬 *${video.title}*\n⏱️ Duration: ${video.timestamp}\n👁️ Views: ${video.views || 'N/A'}`
            });

            fs.unlinkSync(videoPath);

        } catch (error) {
            console.error('Video command error:', error);
            
            if (error.message?.includes('403') || error.statusCode === 403) {
                await TmT.sendMessage(from, { text: '❌ YouTube is blocking this request. This usually resolves within a few hours. Try again later or try a different video.' });
            } else if (error.message?.includes('429')) {
                await TmT.sendMessage(from, { text: '❌ Too many requests. Please wait a few minutes and try again.' });
            } else {
                await TmT.sendMessage(from, { text: `❌ Failed to download. Try another video or try again later.` });
            }
        }
    }
};
