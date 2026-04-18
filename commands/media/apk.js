const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Create temp folder
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

module.exports = {
    name: 'apk',
    alias: ['app', 'android'],
    description: 'Download APK files by app name',
    category: 'downloader',
    async execute(TmT, message, args, command) {
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide an app name!\nExample: .apk Spotify' });
        }
        
        const query = args.join(' ');
        await TmT.sendMessage(message.key.remoteJid, { text: `🔍 Searching for "${query}" APK...` });
        
        try {
            // Using droidly API (no HTML scraping needed)
            const searchResponse = await axios.get(`https://droidly.io/api/v1/search?q=${encodeURIComponent(query)}`);
            
            if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
                return TmT.sendMessage(message.key.remoteJid, { text: '❌ No APK found for that app!' });
            }
            
            const app = searchResponse.data.results[0];
            const apkUrl = app.download_link;
            
            await TmT.sendMessage(message.key.remoteJid, { text: `📥 Found: ${app.name}\n⏳ Downloading...` });
            
            // Download APK
            const safeName = app.name.replace(/[^\w\s]/gi, '').substring(0, 30);
            const apkFileName = `${safeName}.apk`;
            const apkPath = path.join(__dirname, '..', 'temp', apkFileName);
            
            const response = await axios({
                method: 'GET',
                url: apkUrl,
                responseType: 'stream'
            });
            
            const writer = fs.createWriteStream(apkPath);
            response.data.pipe(writer);
            
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
            
            const stats = fs.statSync(apkPath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            
            await TmT.sendMessage(message.key.remoteJid, {
                document: { url: apkPath },
                mimetype: 'application/vnd.android.package-archive',
                fileName: apkFileName,
                caption: `📱 *App:* ${app.name}\n📦 *Size:* ${fileSizeMB} MB\n✅ Download complete!`
            });
            
            fs.unlinkSync(apkPath);
            
        } catch (error) {
            console.error('APK error:', error);
            await TmT.sendMessage(message.key.remoteJid, { text: '❌ Failed to download APK. Try another app name.' });
        }
    }
};
