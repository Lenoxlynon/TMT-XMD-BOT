const fs = require('fs');
const path = require('path');
const ytSearch = require('yt-search');

const tempDir = path.join(__dirname, '..', '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cache ytdl module to avoid repeated imports
let ytdlModule = null;
async function getYtdl() {
    if (!ytdlModule) {
        // @ybd-project/ytdl-core v5+ supports both class and old-style default export
        const mod = await import('@ybd-project/ytdl-core');
        ytdlModule = mod.default || mod;
        // If it's a class, use the .download method
        if (ytdlModule.YtdlCore) {
            const instance = new ytdlModule.YtdlCore();
            ytdlModule = (url, opts) => instance.download(url, { ...opts, streamType: 'nodejs' });
        }
    }
    return ytdlModule;
}

module.exports = {
    name: 'play',
    alias: ['music', 'song', 'ytmp3'],
    description: 'Download music as audio',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;

        if (!args[0]) {
            return TmT.sendMessage(from, { text: '❌ Please provide a song name!\nExample: .play Shape of You' });
        }

        const query = args.join(' ');
        await TmT.sendMessage(from, { text: `🎵 Searching for "${query}"...` });

        try {
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return TmT.sendMessage(from, { text: '❌ No results found!' });
            }

            const video = searchResults.videos[0];

            // Duration limit (e.g., 10 minutes)
            if (video.seconds > 600) {
                return TmT.sendMessage(from, { text: '❌ Video too long. Maximum 10 minutes.' });
            }

            const videoUrl = video.url;
            await TmT.sendMessage(from, { text: `📥 Found: ${video.title}\n⏳ Downloading audio...` });

            // Safe unique filename
            const safeTitle = (video.title.replace(/[^\w\s]/gi, '').trim().substring(0, 50)) || 'audio';
            const audioFileName = `${safeTitle}_${Date.now()}.mp3`;
            const audioPath = path.join(tempDir, audioFileName);

            const ytdl = await getYtdl();

            // Download attempts: high quality then low quality
            const attempts = [
                { quality: 'highestaudio', label: 'high' },
                { quality: 'highestaudio', label: 'high-retry' },
                { quality: 'lowestaudio', label: 'low' },
            ];

            let downloadSuccess = false;
            let lastError = null;

            for (const attempt of attempts) {
                try {
                    const stream = ytdl(videoUrl, {
                        filter: 'audioonly',
                        quality: attempt.quality,
                        requestOptions: {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.5',
                            }
                        }
                    });

                    await new Promise((resolve, reject) => {
                        const writeStream = fs.createWriteStream(audioPath);
                        stream.on('error', (err) => {
                            writeStream.destroy();
                            reject(err);
                        });
                        writeStream.on('error', reject);
                        writeStream.on('finish', resolve);
                        stream.pipe(writeStream);
                    });

                    downloadSuccess = true;
                    break;
                } catch (err) {
                    lastError = err;
                    console.log(`Download attempt (${attempt.label}) failed:`, err.message);
                    // Clean up partially written files
                    if (fs.existsSync(audioPath)) {
                        try { fs.unlinkSync(audioPath); } catch (_) {}
                    }
                    await delay(3000);
                }
            }

            if (!downloadSuccess) {
                throw lastError || new Error('All download attempts failed');
            }

            // Send audio (single send is sufficient; sending as both audio and document is redundant and doubles bandwidth)
            await TmT.sendMessage(from, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `🎧 *${video.title}*\n⏱️ Duration: ${video.timestamp}`
            });

            await TmT.sendMessage(from, { text: '✅ Audio sent successfully!' });

        } catch (error) {
            console.error('Play command error:', error);

            if (error.message?.includes('429') || error.statusCode === 429) {
                await TmT.sendMessage(from, { text: '❌ YouTube rate limit. Please wait a few minutes.' });
            } else if (error.message?.includes('403') || error.statusCode === 403) {
                await TmT.sendMessage(from, { text: '❌ YouTube blocked the request. Try again later.' });
            } else if (error.message?.includes('private') || error.message?.includes('age')) {
                await TmT.sendMessage(from, { text: '❌ This video is private or age-restricted.' });
            } else {
                await TmT.sendMessage(from, { text: '❌ Download failed. Try another song.' });
            }
        } finally {
            // Ensure temporary file is always deleted
            if (typeof audioPath !== 'undefined' && fs.existsSync(audioPath)) {
                try { fs.unlinkSync(audioPath); } catch (_) {}
            }
        }
    }
};
