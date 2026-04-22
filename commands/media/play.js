// commands/media/play.js
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
    name: 'play',
    alias: ['music', 'song', 'ytmp3'],
    description: 'Download music as audio + document file',
    category: 'media',
    async execute(TmT, message, args, command, { from, isGroup, reply }) {
        if (!args[0]) {
            return reply('❌ Please provide a song name!\nExample: .play Shape of You');
        }

        const query = args.join(' ');
        await TmT.sendMessage(from, { text: `🎵 Searching for "${query}"...` });

        try {
            // Search for the video on YouTube
            const searchResults = await ytSearch(query);
            if (!searchResults.videos.length) {
                return reply('❌ No results found!');
            }

            const video = searchResults.videos[0];
            const videoUrl = video.url;

            await TmT.sendMessage(from, { text: `📥 Found: ${video.title}\n⏳ Downloading audio...` });

            // Create a safe filename
            const safeTitle = video.title.replace(/[^\w\s]/gi, '').substring(0, 50);
            const audioFileName = `${safeTitle}.mp3`;
            const audioPath = path.join(tempDir, audioFileName);

            // Download the audio using @distube/ytdl-core
            // Add a 'requestOptions' to mimic a browser user-agent, which can help avoid blocks
            const audioStream = ytdl(videoUrl, {
                filter: 'audioonly',
                quality: 'highestaudio',
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    }
                }
            });

            const writeStream = fs.createWriteStream(audioPath);
            await new Promise((resolve, reject) => {
                audioStream.pipe(writeStream);
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            // Send the audio file
            await TmT.sendMessage(from, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `🎧 *${video.title}*\n⏱️ Duration: ${video.timestamp}`
            });

            // Send the same file as a document
            await TmT.sendMessage(from, {
                document: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: audioFileName,
                caption: `📄 *Saved as:* ${audioFileName}`
            });

            // Clean up the temporary file
            fs.unlinkSync(audioPath);
            await reply('✅ Audio and document sent successfully!');

        } catch (error) {
            console.error('Play command error:', error);
            // Check for specific error types to give better feedback [citation:4]
            if (error.statusCode === 429) {
                await reply('❌ YouTube is rate-limiting us. Please wait a moment and try again.');
            } else if (error.message.includes('signature')) {
                await reply('❌ A YouTube update broke this feature. Please report this to the bot owner to update the library.');
            } else {
                await reply(`❌ Failed to download. Try another song. (Error: ${error.message.substring(0, 50)})`);
            }
        }
    }
};
