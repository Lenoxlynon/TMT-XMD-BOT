/**
 * .play command using external API (Keith MD API)
 * Alternative to ytdl-core when YouTube blocks requests
 */

const axios = require('axios');
const yts = require('yt-search');

module.exports = {
    name: 'playapi',
    alias: ['play2', 'music2', 'song2'],
    description: 'Download music using external API (Alternative method)',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        
        // Get search query from arguments
        const searchQuery = args.join(' ').trim();
        
        if (!searchQuery) {
            return TmT.sendMessage(from, { 
                text: "❌ What song do you want to download?\n\nExample: .playapi Shape of You"
            });
        }

        await TmT.sendMessage(from, {
            text: "🔍 *Searching for your song...*\n_Please wait_"
        });

        try {
            // Step 1: Search YouTube for the song
            const { videos } = await yts(searchQuery);
            
            if (!videos || videos.length === 0) {
                return TmT.sendMessage(from, { 
                    text: "❌ No songs found! Try a different search term."
                });
            }

            // Get the first video result
            const video = videos[0];
            const urlYt = video.url;
            const title = video.title;

            await TmT.sendMessage(from, {
                text: `📥 *Found:* ${title}\n⏳ *Fetching download link...*`
            });

            // Step 2: Fetch audio data from the API
            const response = await axios.get(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const data = response.data;

            // Step 3: Check if API returned valid data
            if (!data || !data.status || !data.result || !data.result.downloadUrl) {
                console.error('API response:', data);
                return TmT.sendMessage(from, { 
                    text: "❌ Failed to fetch audio from the API. Please try again later.\n\n_Try using .play instead_"
                });
            }

            const audioUrl = data.result.downloadUrl;
            const audioTitle = data.result.title || title;

            // Step 4: Send the audio file
            await TmT.sendMessage(from, {
                audio: { url: audioUrl },
                mimetype: "audio/mpeg",
                fileName: `${audioTitle.replace(/[^\w\s]/gi, '')}.mp3`,
                caption: `🎧 *${audioTitle}*\n\n📥 Downloaded using external API\n⚡ Powered by TMT-XMD-BOT`
            });

        } catch (error) {
            console.error('Error in playapi command:', error);
            
            // Handle specific errors
            if (error.code === 'ECONNABORTED') {
                await TmT.sendMessage(from, { 
                    text: "❌ Request timeout. The API is taking too long to respond.\n\n_Try again later or use .play_"
                });
            } else if (error.response?.status === 429) {
                await TmT.sendMessage(from, { 
                    text: "❌ API rate limit reached. Please wait a few minutes and try again."
                });
            } else {
                await TmT.sendMessage(from, { 
                    text: "❌ Download failed. Please try again later.\n\n_Tip: Use .play as an alternative_"
                });
            }
        }
    }
};
