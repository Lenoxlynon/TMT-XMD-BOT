/**
 * Video Command - Download YouTube videos with multiple API fallbacks
 * Uses EliteProTech, Yupra, and Okatsu APIs as fallbacks
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

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

// EliteProTech API - Primary
async function getEliteProTechVideoByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title
        };
    }
    throw new Error('EliteProTech returned no download');
}

async function getYupraVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.result?.mp4) {
        return { 
            download: res.data.result.mp4, 
            title: res.data.result.title 
        };
    }
    throw new Error('Okatsu returned no mp4');
}

module.exports = {
    name: 'videoapi',
    alias: ['vdownload', 'ytvideo', 'videodl'],
    description: 'Download YouTube videos with multiple API fallbacks',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        const searchQuery = args.join(' ').trim();

        if (!searchQuery) {
            return TmT.sendMessage(from, { 
                text: '🎥 *Video Downloader*\n\nUsage: .videoapi <video name or YouTube link>\nExample: .videoapi Shape of You\n\n*Features:*\n• Multiple API fallbacks\n• High quality MP4\n• No YouTube blocks' 
            });
        }

        await TmT.sendMessage(from, { text: '🔍 *Searching for your video...*' });

        try {
            let videoUrl = '';
            let videoTitle = '';
            let videoThumbnail = '';

            // Check if input is a YouTube URL
            if (searchQuery.startsWith('http://') || searchQuery.startsWith('https://')) {
                videoUrl = searchQuery;
                // Extract video ID for thumbnail
                const ytIdMatch = videoUrl.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/);
                if (ytIdMatch) {
                    videoThumbnail = `https://i.ytimg.com/vi/${ytIdMatch[1]}/sddefault.jpg`;
                }
            } else {
                // Search YouTube for the video
                const { videos } = await yts(searchQuery);
                if (!videos || videos.length === 0) {
                    return TmT.sendMessage(from, { text: '❌ No videos found! Try a different search term.' });
                }
                videoUrl = videos[0].url;
                videoTitle = videos[0].title;
                videoThumbnail = videos[0].thumbnail;
            }

            // Send thumbnail if available
            if (videoThumbnail) {
                await TmT.sendMessage(from, {
                    image: { url: videoThumbnail },
                    caption: `🎬 *${videoTitle || searchQuery}*\n⏳ Downloading video...`
                });
            } else {
                await TmT.sendMessage(from, { text: `📥 Downloading: *${videoTitle || searchQuery}*` });
            }

            // Validate YouTube URL
            const urlPattern = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/i;
            if (!urlPattern.test(videoUrl)) {
                return TmT.sendMessage(from, { text: '❌ Invalid YouTube URL!' });
            }

            // Try multiple APIs with fallback chain
            let videoData;
            let downloadSuccess = false;
            
            const apiMethods = [
                { name: 'EliteProTech', method: () => getEliteProTechVideoByUrl(videoUrl) },
                { name: 'Yupra', method: () => getYupraVideoByUrl(videoUrl) },
                { name: 'Okatsu', method: () => getOkatsuVideoByUrl(videoUrl) }
            ];
            
            for (const apiMethod of apiMethods) {
                try {
                    videoData = await apiMethod.method();
                    const videoUrlCheck = videoData.download;
                    
                    if (!videoUrlCheck) {
                        console.log(`${apiMethod.name} returned no download URL, trying next...`);
                        continue;
                    }
                    
                    downloadSuccess = true;
                    break;
                } catch (apiErr) {
                    console.log(`${apiMethod.name} API failed:`, apiErr.message);
                    continue;
                }
            }
            
            if (!downloadSuccess || !videoData) {
                throw new Error('All download sources failed');
            }

            // Send the video
            await TmT.sendMessage(from, {
                video: { url: videoData.download },
                mimetype: 'video/mp4',
                fileName: `${(videoData.title || videoTitle || 'video').replace(/[^\w\s-]/g, '')}.mp4`,
                caption: `🎬 *${videoData.title || videoTitle || 'Video'}*\n\n📥 Downloaded using TMT-XMD-BOT\n⚡ Multiple API fallbacks enabled`
            });

        } catch (error) {
            console.error('Video command error:', error);
            
            let errorMessage = '❌ Failed to download video. ';
            if (error.message && error.message.includes('blocked')) {
                errorMessage = '❌ Download blocked. Try using .video instead.';
            } else if (error.message && error.message.includes('All download sources failed')) {
                errorMessage = '❌ All download sources failed. Try a different video or use .video';
            } else {
                errorMessage = '❌ Failed to download. Try another video or use .video';
            }
            
            await TmT.sendMessage(from, { text: errorMessage });
        }
    }
};
