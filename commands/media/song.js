/**
 * Song Command - Download audio from YouTube with multiple API fallbacks
 * Uses EliteProTech, Yupra, and Okatsu APIs as fallbacks
 */

const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../../lib/converter');

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
async function getEliteProTechDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title
        };
    }
    throw new Error('EliteProTech ytdown returned no download');
}

async function getYupraDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
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

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl) {
        return {
            download: res.data.dl,
            title: res.data.title,
            thumbnail: res.data.thumb
        };
    }
    throw new Error('Okatsu ytmp3 returned no download');
}

module.exports = {
    name: 'song',
    alias: ['music', 'download', 'ytmp3'],
    description: 'Download music from YouTube (with multiple API fallbacks)',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        const text = args.join(' ').trim();

        if (!text) {
            return TmT.sendMessage(from, { 
                text: '🎵 *Song Downloader*\n\nUsage: .song <song name or YouTube link>\nExample: .song Shape of You\n\n*Features:*\n• Multiple API fallbacks\n• Automatic format conversion\n• High quality audio' 
            });
        }

        await TmT.sendMessage(from, { text: '🔍 *Searching for your song...*' });

        try {
            let video;
            
            // Check if input is a YouTube URL
            if (text.includes('youtube.com') || text.includes('youtu.be')) {
                video = { url: text };
            } else {
                const search = await yts(text);
                if (!search || !search.videos.length) {
                    return TmT.sendMessage(from, { text: '❌ No results found. Try a different search term.' });
                }
                video = search.videos[0];
            }

            // Send song info
            await TmT.sendMessage(from, {
                text: `🎵 *Downloading:* ${video.title}\n⏱️ *Duration:* ${video.timestamp || 'Unknown'}\n\n📥 Fetching audio from servers...`
            });

            // Try multiple APIs with fallback chain
            let audioData;
            let audioBuffer;
            let downloadSuccess = false;
            
            const apiMethods = [
                { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
                { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
                { name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) }
            ];
            
            for (const apiMethod of apiMethods) {
                if (downloadSuccess) break;
                
                try {
                    audioData = await apiMethod.method();
                    const audioUrl = audioData.download;
                    
                    if (!audioUrl) {
                        console.log(`${apiMethod.name} returned no download URL, trying next...`);
                        continue;
                    }
                    
                    // Download the audio file
                    try {
                        const audioResponse = await axios.get(audioUrl, {
                            responseType: 'arraybuffer',
                            timeout: 90000,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });
                        audioBuffer = Buffer.from(audioResponse.data);
                        
                        if (audioBuffer && audioBuffer.length > 0) {
                            downloadSuccess = true;
                            break;
                        }
                    } catch (downloadErr) {
                        console.log(`${apiMethod.name} download failed:`, downloadErr.message);
                        continue;
                    }
                } catch (apiErr) {
                    console.log(`${apiMethod.name} API failed:`, apiErr.message);
                    continue;
                }
            }
            
            if (!downloadSuccess || !audioBuffer) {
                throw new Error('All download sources failed. Try another song or use .play');
            }

            // Detect audio format
            let finalBuffer = audioBuffer;
            let finalMimetype = 'audio/mpeg';
            let finalExtension = 'mp3';

            // Check if already MP3
            const isMp3 = audioBuffer.toString('ascii', 0, 3) === 'ID3' || 
                         (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0);
            
            if (!isMp3) {
                try {
                    await TmT.sendMessage(from, { text: '🔄 Converting audio format...' });
                    finalBuffer = await toAudio(audioBuffer, 'm4a');
                } catch (convErr) {
                    console.error('Conversion error:', convErr);
                    // Send original format if conversion fails
                }
            }

            // Send the audio file
            await TmT.sendMessage(from, {
                audio: finalBuffer,
                mimetype: finalMimetype,
                fileName: `${(audioData?.title || video.title).replace(/[^\w\s-]/g, '')}.${finalExtension}`,
                caption: `🎧 *${audioData?.title || video.title}*\n\n📥 Downloaded using TMT-XMD-BOT\n⚡ Multiple API fallbacks enabled`
            });

            // Cleanup temp files
            const tempDir = path.join(__dirname, '../../temp');
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                const now = Date.now();
                files.forEach(file => {
                    const filePath = path.join(tempDir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (now - stats.mtimeMs > 10000 && (file.endsWith('.mp3') || file.endsWith('.m4a'))) {
                            fs.unlinkSync(filePath);
                        }
                    } catch (e) {}
                });
            }

        } catch (error) {
            console.error('Song command error:', error);
            
            let errorMessage = '❌ Failed to download song. ';
            if (error.message && error.message.includes('blocked')) {
                errorMessage = '❌ Download blocked. Try using .play instead.';
            } else if (error.message && error.message.includes('All download sources failed')) {
                errorMessage = '❌ All download sources failed. Try a different song or use .play';
            } else {
                errorMessage = '❌ Failed to download. Try another song or use .play';
            }
            
            await TmT.sendMessage(from, { text: errorMessage });
        }
    }
};
