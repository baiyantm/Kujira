const log = require('log4js').getLogger('utils/messages');

// For types ...
const { Discord } = require('discord.js');

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
const startLoading = function (message) {
    message.react("🔄");
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
const endLoading = async function (message, retry) {
    let reaction = message.reactions.cache.find(r => r.emoji.name == "🔄");
    if (reaction != null) {
        await reaction.users.remove(message.client.user);
        message.react("✅");
    } else {
        if (retry < 5) {
            setTimeout(() => {
                endLoading(message, retry++);
            }, 1000);
        }
    }
}

module.exports = {
    startLoading,
    endLoading
}
