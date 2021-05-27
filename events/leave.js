const log = require('log4js').getLogger('events/leave');

const Client = require("../client");

const { wSendChannel } = require("../modules/interactions");

/**
 * listener for member leaving guild
 * @param {Discord.GuildMember | Discord.PartialGuildMember} member 
 * @param {Client} client the bot
 */
module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        try {
            let channelID = client.servers.get(member.guild.id).welcome;
            // cache will be used if available (suposedly)
            let channel = await client.channels.fetch(channelID);
            wSendChannel(channel, member.toString() + "(" + member.user.username + ") has left the server.")
        } catch (err) {
            log.error(err);
        }
    }
}
