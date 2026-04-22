// commands/media/video.js
const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

// Create temp folder if it doesn't exist
const tempDir = path.join(__dirname, '..', '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

module.exports = {
    name: 'video',
    alias: ['vd', 'ytvideo', 'mp4'],
    description: 'Download video by searching name',
    category: 'media',
    async execute(TmT, message, args, command) {
        // Get values directly from message and TmT (no destructuring from undefined)
        const from = message.key.remoteJid;
        
        if (!args[0]) {
            return TmT.sendMessage(from, { text: '❌ Please provide a video name!\nExample: .video Shape of You' });
        }

        const query = args.join(' ');
        await TmT.sendMessage(from, { text: `🔍 Searching for "${query}"...` });

        try {
            // Search for the video on YouTube
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return TmT.sendMessage(from, { text: '❌ No videos found!' });
            }

            const video = searchResults.videos[0];
            const videoUrl = video.url;

            await TmT.sendMessage(from, { text: `📥 Found: ${video.title}\n⏳ Downloading video...` });

            // Create a safe filename
            const safeTitle = video.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const videoFileName = `${safeTitle}.mp4`;
            const videoPath = path.join(tempDir, videoFileName);

            // Download the VIDEO
            const videoStream = ytdl(videoUrl, {
                quality: '18',
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

            // Send the video file
            await TmT.sendMessage(from, {
                video: { url: videoPath },
                caption: `🎬 *${video.title}*\n⏱️ Duration: ${video.timestamp}\n👁️ Views: ${video.views || 'N/A'}`
            });

            // Clean up the temporary file
            fs.unlinkSync(videoPath);

        } catch (error) {
            console.error('Video command error:', error);
            
            if (error.statusCode === 429) {
                await TmT.sendMessage(from, { text: '❌ YouTube is rate-limiting us. Please wait a moment and try again.' });
            } else {
                await TmT.sendMessage(from, { text: `❌ Failed to download video. Try another name.` });
            }
        }
    }
};
