const log = require('log4js').getLogger('commands/gear');
const interactions = require('../../modules/interactions');
const { WhitelistedMemberChannels, Members } = require('../../constants').Guilds.Remedy;

module.exports = {
    name: 'gear',
    description: '',
    whitelist: {
        roles: [Members],
        channels: WhitelistedMemberChannels,
    },
    execute(message, member) {
        log.mark('gear command');
        // TODO priority: high
    },
};

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
 function gearCommand(message, args) {
    startLoading(message);
    let idToFind = getPlayerByIdOrMention(message, args);
    let playerFound = players.get(idToFind);
    if (playerFound && playerFound instanceof Player) {
        interactions.wSendChannel(message.channel, players.displayFullPlayerGS(playerFound));
    }
    else {
        interactions.wSendChannel(message.channel, "Couldn't find this player.");
    }
    endLoading(message, 0);
}
