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
    description: 'Search and get APK download links',
    category: 'media',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        
        if (!args[0]) {
            return TmT.sendMessage(from, { text: '❌ Please provide an app name!\nExample: .apk Spotify' });
        }
        
        const query = args.join(' ');
        await TmT.sendMessage(from, { text: `🔍 Searching for "${query}" APK...` });
        
        try {
            // Method 1: Try APKCombo (more reliable)
            let apkUrl = await searchApkCombo(query);
            
            // Method 2: Fallback to APKPure mirror
            if (!apkUrl) {
                apkUrl = await searchApkPureMirror(query);
            }
            
            // Method 3: Fallback to APKDownload (last resort)
            if (!apkUrl) {
                apkUrl = await searchApkDownload(query);
            }
            
            if (!apkUrl) {
                return TmT.sendMessage(from, { text: '❌ No APK found for that app! Try a different name.\n\n💡 Tip: Use exact app name (e.g., .apk com.whatsapp)' });
            }
            
            await TmT.sendMessage(from, { text: `📥 Found APK! Downloading...\n⏳ This may take 10-20 seconds.` });
            
            await downloadAndSendApk(TmT, message, apkUrl, query);
            
        } catch (error) {
            console.error('APK error:', error);
            await TmT.sendMessage(from, { text: '❌ Failed to download APK. Try another app name or use exact package name.\n\nExample: .apk com.spotify.music' });
        }
    }
};

// Search on APKCombo
async function searchApkCombo(query) {
    try {
        const searchUrl = `https://apkcombo.com/search/?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            },
            timeout: 10000
        });
        
        // Extract download link
        const match = response.data.match(/https:\/\/apkcombo\.com\/[^\/]+\/[^\/]+\/download\/apk/);
        if (match) return match[0];
        
        return null;
    } catch (error) {
        console.error('APKCombo error:', error.message);
        return null;
    }
}

// Search on APKPure Mirror
async function searchApkPureMirror(query) {
    try {
        const searchUrl = `https://apkpure.net/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const match = response.data.match(/https:\/\/download\.apkpure\.net\/[^"']+\.apk/);
        if (match) return match[0];
        
        return null;
    } catch (error) {
        console.error('APKPure error:', error.message);
        return null;
    }
}

// Search on APKDownload
async function searchApkDownload(query) {
    try {
        const searchUrl = `https://apkdownload.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const match = response.data.match(/https:\/\/apkdownload\.com\/download\/[^"']+\.apk/);
        if (match) return match[0];
        
        return null;
    } catch (error) {
        console.error('APKDownload error:', error.message);
        return null;
    }
}

// Download and send APK
async function downloadAndSendApk(TmT, message, apkUrl, appName) {
    const from = message.key.remoteJid;
    
    try {
        const safeName = appName.replace(/[^\w\s]/gi, '').substring(0, 30);
        const apkFileName = `${safeName}.apk`;
        const apkPath = path.join(tempDir, apkFileName);
        
        const response = await axios({
            method: 'GET',
            url: apkUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        });
        
        const writer = fs.createWriteStream(apkPath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        const stats = fs.statSync(apkPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        if (stats.size > 100 * 1024 * 1024) {
            fs.unlinkSync(apkPath);
            return TmT.sendMessage(from, { text: '❌ APK file is too large (over 100MB). WhatsApp does not support files this large.' });
        }
        
        await TmT.sendMessage(from, {
            document: { url: apkPath },
            mimetype: 'application/vnd.android.package-archive',
            fileName: apkFileName,
            caption: `📱 *App:* ${appName}\n📦 *Size:* ${fileSizeMB} MB\n✅ Download complete!\n\n⚠️ Only install APKs from trusted sources.`
        });
        
        fs.unlinkSync(apkPath);
        
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}
