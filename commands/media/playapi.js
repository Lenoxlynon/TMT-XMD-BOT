/**
 * .playapi command - Download music using external API with retry logic
 */

const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

// Retry function with exponential backoff
async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = 1000 * Math.pow(2, attempt - 1);
                console.log(`Retry ${attempt}/${attempts} after ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

// List of backup APIs (if Keith API fails)
const BACKUP_APIS = [
    {
        name: 'Keith API',
        getUrl: (videoUrl) => `https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(videoUrl)}`,
        parseResponse: (data) => {
            if (data?.status && data?.result?.downloadUrl) {
                return { download: data.result.downloadUrl, title: data.result.title };
            }
            return null;
        }
    },
    {
        name: 'EliteProTech',
        getUrl: (videoUrl) => `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(videoUrl)}&format=mp3`,
        parseResponse: (data) => {
            if (data?.success && data?.downloadURL) {
                return { download: data.downloadURL, title: data.title };
            }
            return null;
        }
    },
    {
        name: 'Yupra',
        getUrl: (videoUrl) => `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`,
        parseResponse: (data) => {
            if (data?.success && data?.data?.download_url) {
                return { download: data.data.download_url, title: data.data.title };
            }
            return null;
        }
    }
];

module.exports = {
    name: 'playapi',
    alias: ['play2', 'music2', 'song2'],
    description: 'Download music using external API (Alternative method)',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        const searchQuery = args.join(' ').trim();

        if (!searchQuery) {
            return TmT.sendMessage(from, { 
                text: "❌ What song do you want to download?\n\nExample: .playapi Shape of You"
            });
        }

        await TmT.sendMessage(from, { text: "🔍 *Searching for your song...*" });

        try {
            // Search YouTube
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                return TmT.sendMessage(from, { text: "❌ No songs found! Try a different search term." });
            }

            const video = videos[0];
            const videoUrl = video.url;
            const title = video.title;

            await TmT.sendMessage(from, { text: `📥 *Found:* ${title}\n⏳ *Fetching download link...*` });

            // Try each API in sequence until one works
            let audioData = null;
            let usedApi = null;

            for (const api of BACKUP_APIS) {
                try {
                    console.log(`Trying ${api.name} API...`);
                    const response = await tryRequest(() => 
                        axios.get(api.getUrl(videoUrl), { 
                            ...AXIOS_DEFAULTS,
                            timeout: 30000 
                        })
                    );
                    
                    const result = api.parseResponse(response.data);
                    if (result && result.download) {
                        audioData = result;
                        usedApi = api.name;
                        break;
                    }
                } catch (err) {
                    console.log(`${api.name} API failed:`, err.message);
                    continue;
                }
            }

            if (!audioData || !audioData.download) {
                throw new Error('All APIs failed to provide a download link');
            }

            await TmT.sendMessage(from, { text: `✅ *Using ${usedApi} API*\n📥 Downloading audio...` });

            // Download the audio file
            const audioResponse = await axios.get(audioData.download, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const audioBuffer = Buffer.from(audioResponse.data);

            // Send the audio file
            await TmT.sendMessage(from, {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                fileName: `${(audioData.title || title).replace(/[^\w\s-]/g, '')}.mp3`,
                caption: `🎧 *${audioData.title || title}*\n\n📥 Downloaded via ${usedApi}\n⚡ Powered by TMT-XMD-BOT`
            });

        } catch (error) {
            console.error('PlayAPI error:', error);
            
            let errorMessage = '❌ Failed to download song. ';
            if (error.message && error.message.includes('timeout')) {
                errorMessage = '❌ API request timed out. The servers are busy. Try again later or use .play';
            } else if (error.message && error.message.includes('All APIs failed')) {
                errorMessage = '❌ All download sources are currently unavailable. Please use .play instead.';
            } else {
                errorMessage = '❌ Download failed. Please try again later.\n\n_Tip: Use .play as an alternative_';
            }
            
            await TmT.sendMessage(from, { text: errorMessage });
        }
    }
};
