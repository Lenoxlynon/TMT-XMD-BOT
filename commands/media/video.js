// commands/media/video.js
const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core'); // Use the maintained fork
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
    async execute(TmT, message, args, command, { from, reply }) {
        if (!args[0]) {
            return reply('❌ Please provide a video name!\nExample: .video Shape of You');
        }

        const query = args.join(' ');
        await TmT.sendMessage(from, { text: `🔍 Searching for "${query}"...` });

        try {
            // Search for the video on YouTube
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return reply('❌ No videos found!');
            }

            const video = searchResults.videos[0];
            const videoUrl = video.url;

            await TmT.sendMessage(from, { text: `📥 Found: ${video.title}\n⏳ Downloading video...` });

            // Create a safe filename
            const safeTitle = video.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const videoFileName = `${safeTitle}.mp4`;
            const videoPath = path.join(tempDir, videoFileName);

            // Download the VIDEO (not just audio)
            const videoStream = ytdl(videoUrl, {
                quality: '18', // 360p (good balance of quality and size)
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
            });

            // Send the video file
            await TmT.sendMessage(from, {
                video: { url: videoPath },
                caption: `🎬 *${video.title}*\n⏱️ Duration: ${video.timestamp}\n👁️ Views: ${video.views || 'N/A'}`
            });

            // Clean up the temporary file
            fs.unlinkSync(videoPath);
            await reply('✅ Video sent successfully!');

        } catch (error) {
            console.error('Video command error:', error);
            
            if (error.statusCode === 429) {
                await reply('❌ YouTube is rate-limiting us. Please wait a moment and try again.');
            } else if (error.message.includes('signature')) {
                await reply('❌ A YouTube update broke this feature. Please report this to the bot owner.');
            } else {
                await reply(`❌ Failed to download video. Try another name.`);
            }
        }
    }
};
