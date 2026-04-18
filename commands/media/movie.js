const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'movie',
    alias: ['film', 'watch'],
    description: 'Get movie download/streaming links',
    category: 'downloader',
    async execute(TmT, message, args, command) {
        if (!args[0]) {
            return TmT.sendMessage(message.key.remoteJid, { 
                text: '❌ Please provide a movie name!\nExample: .movie Inception' 
            });
        }
        
        const query = args.join(' ');
        await TmT.sendMessage(message.key.remoteJid, { 
            text: `🎬 Searching for "${query}"...` 
        });
        
        try {
            // Using free movie API (example - you may need a real API key)
            const searchResponse = await axios.get(
                `https://api.themoviedb.org/3/search/movie?api_key=YOUR_API_KEY&query=${encodeURIComponent(query)}`
            );
            
            if (!searchResponse.data.results || searchResponse.data.results.length === 0) {
                return TmT.sendMessage(message.key.remoteJid, { 
                    text: '❌ No movies found! Try a different name.' 
                });
            }
            
            const movie = searchResponse.data.results[0];
            
            // Generate search links for download sites
            const downloadLinks = `🔍 *Search these sites manually:*\n\n` +
                `🎥 *YouTube Movies:* https://youtube.com/results?search_query=${encodeURIComponent(movie.title + " full movie")}\n` +
                `📺 *Dailymotion:* https://dailymotion.com/search/${encodeURIComponent(movie.title)}\n` +
                `🎬 *Internet Archive:* https://archive.org/search.php?query=${encodeURIComponent(movie.title)}\n` +
                `📽️ *Putlocker:* https://www.putlocker.style/search/${encodeURIComponent(movie.title.replace(/ /g, '-'))}\n\n` +
                `⚠️ *Note:* Download movies at your own risk. Respect copyright laws.`;
            
            // Create fancy movie info message
            const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
            const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
            
            const movieInfo = `🎬 *${movie.title}* (${year})\n` +
                `⭐ Rating: ${rating}/10\n` +
                `📖 Overview: ${movie.overview.substring(0, 200)}...\n\n` +
                downloadLinks;
            
            // Try to send poster image if available
            if (movie.poster_path) {
                const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                await TmT.sendMessage(message.key.remoteJid, {
                    image: { url: posterUrl },
                    caption: movieInfo
                });
            } else {
                await TmT.sendMessage(message.key.remoteJid, { text: movieInfo });
            }
            
        } catch (error) {
            console.error('Movie search error:', error);
            
            // Fallback: Provide generic search links
            const fallbackMessage = `🎬 *Movie Search for: ${query}*\n\n` +
                `🔗 Try searching these sites:\n` +
                `• YouTube: https://youtube.com/results?search_query=${encodeURIComponent(query + " full movie")}\n` +
                `• Dailymotion: https://dailymotion.com/search/${encodeURIComponent(query)}\n` +
                `• Archive.org: https://archive.org/search.php?query=${encodeURIComponent(query)}\n\n` +
                `⚠️ Always respect copyright laws.`;
            
            await TmT.sendMessage(message.key.remoteJid, { text: fallbackMessage });
        }
    }
};
