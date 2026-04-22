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
    alias: ['app', 'android', 'apkdl'],
    description: 'Search and download APK files',
    category: 'downloader',
    async execute(TmT, message, args, command) {
        const from = message.key.remoteJid;
        
        if (!args[0]) {
            return TmT.sendMessage(from, { text: '❌ Please provide an app name!\nExample: .apk spotify\n\n💡 Use exact package name: .apk com.whatsapp' });
        }
        
        const query = args.join(' ');
        await TmT.sendMessage(from, { text: `🔍 Searching for "${query}" APK...` });
        
        try {
            // Try multiple sources
            let apkUrl = null;
            let appInfo = null;
            
            // Method 1: Try APKCombo (often more reliable)
            apkUrl = await searchApkCombo(query);
            
            // Method 2: Try APKPure with better headers
            if (!apkUrl) {
                apkUrl = await searchApkPure(query);
            }
            
            // Method 3: If it looks like a package name, try direct
            if (!apkUrl && query.includes('.')) {
                apkUrl = await directPackageSearch(query);
            }
            
            // Method 4: Fallback to APKDownload
            if (!apkUrl) {
                apkUrl = await searchApkDownload(query);
            }
            
            if (!apkUrl) {
                // Provide helpful tips
                let tipMessage = '❌ No APK found for that app!\n\n';
                tipMessage += '💡 Tips:\n';
                tipMessage += '• Use exact app name: .apk spotify\n';
                tipMessage += '• Or use package name: .apk com.spotify.music\n';
                tipMessage += '• Try shorter names: .apk fb (for Facebook)\n';
                tipMessage += '• Check spelling and try again';
                return TmT.sendMessage(from, { text: tipMessage });
            }
            
            await TmT.sendMessage(from, { text: `📥 Downloading APK...\n⏳ This may take 15-30 seconds.` });
            
            await downloadAndSendApk(TmT, message, apkUrl, query);
            
        } catch (error) {
            console.error('APK error:', error);
            await TmT.sendMessage(from, { text: '❌ Failed to download APK.\n\nTry using the exact package name:\n.apk com.whatsapp\n\nOr try a different app name.' });
        }
    }
};

// Search on APKCombo
async function searchApkCombo(query) {
    try {
        const searchTerm = query.toLowerCase().trim();
        const searchUrl = `https://apkcombo.com/search/?q=${encodeURIComponent(searchTerm)}`;
        
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 15000
        });
        
        // Extract first APK download link
        const match = response.data.match(/https:\/\/apkcombo\.com\/[a-z0-9.-]+\/[a-z0-9.-]+\/download\/apk/);
        if (match) return match[0];
        
        // Alternative pattern
        const altMatch = response.data.match(/https:\/\/apkcombo\.com\/download-apk\/[^"']+/);
        if (altMatch) return altMatch[0];
        
        return null;
    } catch (error) {
        console.error('APKCombo error:', error.message);
        return null;
    }
}

// Search on APKPure
async function searchApkPure(query) {
    try {
        const searchUrl = `https://apkpure.net/search?q=${encodeURIComponent(query)}`;
        
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            },
            timeout: 15000
        });
        
        // Extract download URL
        const match = response.data.match(/https:\/\/download\.apkpure\.net\/[^"']+\.apk/);
        if (match) return match[0];
        
        return null;
    } catch (error) {
        console.error('APKPure error:', error.message);
        return null;
    }
}

// Direct search by package name
async function directPackageSearch(packageName) {
    try {
        // Try to fetch from APKCombo directly using package name
        const url = `https://apkcombo.com/apk/${packageName}/download/apk`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            },
            timeout: 10000,
            maxRedirects: 5
        });
        
        // Look for download link
        const match = response.data.match(/https:\/\/apkcombo\.com\/[^"']+\.apk/);
        if (match) return match[0];
        
        return null;
    } catch (error) {
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
            timeout: 15000
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
            timeout: 45000
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
            return TmT.sendMessage(from, { text: '❌ APK is too large (over 100MB). WhatsApp limit reached.' });
        }
        
        await TmT.sendMessage(from, {
            document: { url: apkPath },
            mimetype: 'application/vnd.android.package-archive',
            fileName: apkFileName,
            caption: `📱 *App:* ${appName}\n📦 *Size:* ${fileSizeMB} MB\n✅ Download complete!\n\n⚠️ Only install APKs from trusted sources.`
        });
        
        fs.unlinkSync(apkPath);
        
    } catch (error) {
        console.error('Download error:', error.message);
        throw error;
    }
}
