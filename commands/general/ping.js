/**
 * Ping Command - Check bot response time with thinking animation
 */

module.exports = {
    name: 'ping',
    aliases: ['p', 'latency'],
    category: 'general',
    description: 'Check bot response time with thinking animation',
    usage: '.ping',
    
    async execute(sock, msg, args, extra) {
      try {
        // Method 1: Fastest response using reaction/typing indicator
        const start = Date.now();
        
        // Send thinking animation (typing indicator)
        await sock.sendPresenceUpdate('composing', extra.from);
        
        // Small delay to show "thinking" effect
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Send initial message
        const sent = await extra.reply('🤔 *Thinking...*');
        
        const midTime = Date.now();
        const thinkingTime = midTime - start;
        
        // Stop typing indicator
        await sock.sendPresenceUpdate('available', extra.from);
        
        // Calculate final response time
        const end = Date.now();
        const totalTime = end - start;
        
        // Best method: Edit message with results (saves one network call)
        await sock.sendMessage(extra.from, {
          text: `╭═══〘𝐓𝐌𝐓-𝐗𝐌𝐃〙═══⊷❍\n\n` +
                `┃✦│🏓 *Pong!*\n` +  // ✅ Fixed: Added missing +
                `┃✦│⏱️ *Thinking Time:* ${thinkingTime}ms\n` +
                `┃✦│⚡ *Total Response:* ${totalTime}ms\n` +
                `┃✦│📡 *Status:* ${totalTime < 1000 ? '✅ Excellent' : totalTime < 2000 ? '⚠️ Good' : '🔴 Slow'}\n\n` +
                `_Response sent in ${totalTime}ms_`,
          edit: sent.key
        });
        
      } catch (error) {
        // Fallback method: Simple response without edit
        try {
          await extra.reply(`🏓 *Pong!*\n⚠️ Response time: ${Date.now() - arguments[0]}ms (simple mode)`);
        } catch (fallbackError) {
          await extra.reply(`❌ Error: ${error.message}`);
        }
      }
    }
  };