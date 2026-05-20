/**
 * .playapi command - Download music using external APIs with multiple fallbacks
 */

const axios = require('axios');
const yts = require('yt-search');

const AXIOS_DEFAULTS = {
    timeout: 30000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

async function tryRequest(getter, attempts = 2) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }
    throw lastError;
}

// List of working APIs (excluding the crashed one)
const WORKING_APIS = [
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
    },
    {
        name: 'Okatsu',
        getUrl: (videoUrl) => `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`,
        parseResponse: (data) => {
            if (data?.dl) {
                return { download: data.dl, title: data.title };
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
                text: "❌ What song do you want to download?\n\nExample: .playapi Shape of You\n\n⚠️ *Note:* If this fails, use .play instead"
            });
        }

        await TmT.sendMessage(from, { text: "🔍 *Searching for your song...*" });

        try {
            // Search YouTube
            const { videos } = await yts(searchQuery);
            if (!videos || videos.length === 0) {
                return TmT.sendMessage(from, { text: "❌ No songs found! Try .play instead." });
            }

            const video = videos[0];
            const videoUrl = video.url;
            const title = video.title;

            await TmT.sendMessage(from, { text: `📥 *Found:* ${title}\n⏳ *Trying APIs...*` });

            let audioData = null;
            let usedApi = null;

            for (const api of WORKING_APIS) {
                try {
                    console.log(`Trying ${api.name} API...`);
                    const response = await tryRequest(() => 
                        axios.get(api.getUrl(videoUrl), AXIOS_DEFAULTS)
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
                // Instead of failing, suggest using .play
                return TmT.sendMessage(from, { 
                    text: "❌ *All APIs are currently unavailable*\n\nPlease use the main command instead:\n`.play " + searchQuery + "`\n\nThis uses direct YouTube downloading and should work."
                });
            }

            // Download the audio file
            const audioResponse = await axios.get(audioData.download, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const audioBuffer = Buffer.from(audioResponse.data);

            // Send the audio file
            await TmT.sendMessage(from, {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                fileName: `${(audioData.title || title).replace(/[^\w\s-]/g, '')}.mp3`,
                caption: `🎧 *${audioData.title || title}*\n\n📥 Downloaded via ${usedApi}`
            });

        } catch (error) {
            console.error('PlayAPI error:', error);
            
            // Suggest using .play instead
            await TmT.sendMessage(from, { 
                text: `❌ *Download failed*\n\nThe external APIs are currently unavailable.\n\nPlease use: .play ${searchQuery || 'Shape of You'}`
            });
        }
    }
};
