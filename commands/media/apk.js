const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Create temp folder if it doesn't exist
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
        // CHECK: Make sure user provided an app name
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { text: '❌ Please provide an app name!\nExample: .apk Spotify' });
        }
        
        // Get the search query
        const query = args.join(' ');
        
        // Send searching message
        await TmT.sendMessage(message.key.remoteJid, { text: `🔍 Searching for "${query}" APK...` });
        
        try {
            // OPTION 1: Using APKMirror (most reliable)
            const apkUrl = await searchApkMirror(query);
            
            if (!apkUrl) {
                // OPTION 2: Fallback to APKPure
                const apkPureUrl = await searchApkPure(query);
                if (!apkPureUrl) {
                    return TmT.sendMessage(message.key.remoteJid, { text: '❌ No APK found for that app! Try a different name.' });
                }
                await downloadAndSendApk(TmT, message, apkPureUrl, query);
            } else {
                await downloadAndSendApk(TmT, message, apkUrl, query);
            }
            
        } catch (error) {
            console.error('APK download error:', error);
            await TmT.sendMessage(message.key.remoteJid, { text: '❌ Failed to download APK. Try another app name.' });
        }
    }
};

// Function to search APKMirror
async function searchApkMirror(query) {
    try {
        const searchQuery = encodeURIComponent(query);
        const response = await axios.get(`https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s=${searchQuery}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Parse HTML to find first APK link
        const match = response.data.match(/https:\/\/www\.apkmirror\.com\/apk\/[^"]+download/);
        if (match) {
            return match[0];
        }
        return null;
    } catch (error) {
        console.error('APKMirror search error:', error);
        return null;
    }
}

// Function to search APKPure
async function searchApkPure(query) {
    try {
        const searchQuery = encodeURIComponent(query);
        const response = await axios.get(`https://apkpure.net/search?q=${searchQuery}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Extract download URL
        const match = response.data.match(/https:\/\/download\.apkpure\.net\/[^"']+\.apk/);
        if (match) {
            return match[0];
        }
        return null;
    } catch (error) {
        console.error('APKPure search error:', error);
        return null;
    }
}

// Function to download and send APK
async function downloadAndSendApk(TmT, message, apkUrl, appName) {
    try {
        await TmT.sendMessage(message.key.remoteJid, { text: `📥 Downloading ${appName} APK...` });
        
        // Create safe filename
        const safeName = appName.replace(/[^\w\s]/gi, '').substring(0, 30);
        const apkFileName = `${safeName}.apk`;
        const apkPath = path.join(__dirname, '..', 'temp', apkFileName);
        
        // Download APK file
        const response = await axios({
            method: 'GET',
            url: apkUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Save to file
        const writer = fs.createWriteStream(apkPath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        // Get file size
        const stats = fs.statSync(apkPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        // Send as document
        await TmT.sendMessage(message.key.remoteJid, {
            document: { url: apkPath },
            mimetype: 'application/vnd.android.package-archive',
            fileName: apkFileName,
            caption: `📱 *App:* ${appName}\n📦 *Size:* ${fileSizeMB} MB\n✅ *Download complete!*\n\n⚠️ Only install APKs from trusted sources.`
        });
        
        // Clean up
        fs.unlinkSync(apkPath);
        
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
    }
