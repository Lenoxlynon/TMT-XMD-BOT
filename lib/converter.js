// lib/converter.js - Audio converter utility
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Convert audio buffer to MP3 format using ffmpeg
 * @param {Buffer} buffer - Input audio buffer
 * @param {string} inputExt - Input file extension (m4a, ogg, wav, etc.)
 * @returns {Promise<Buffer>} - MP3 buffer
 */
async function toAudio(buffer, inputExt = 'm4a') {
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const inputPath = path.join(tempDir, `input_${Date.now()}.${inputExt}`);
    const outputPath = path.join(tempDir, `output_${Date.now()}.mp3`);
    
    try {
        // Write input buffer to file
        fs.writeFileSync(inputPath, buffer);
        
        // Convert using ffmpeg
        await execPromise(`ffmpeg -i "${inputPath}" -acodec libmp3lame -q:a 2 "${outputPath}" -y`);
        
        // Read output file
        const outputBuffer = fs.readFileSync(outputPath);
        
        // Cleanup
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        
        return outputBuffer;
    } catch (error) {
        // Cleanup on error
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        throw new Error(`Conversion failed: ${error.message}`);
    }
}

module.exports = { toAudio };
