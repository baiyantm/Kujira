const log = require('log4js').getLogger('utils/cache');

module.exports = {
    async cacheReactions(client, channel) {
        let messages = await client.fetchAllMessages(channel);
        log.trace(`Fetching reactions from ${channel.guild.name}: ${channel.name}`);
        messages.forEach(msg => {
            msg.reactions.cache.forEach(async r => {
                r.users.fetch();
            })
        })
        return messages;
    },
}