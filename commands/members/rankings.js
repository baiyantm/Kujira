const log = require('log4js').getLogger('commands/rankings');
const interactions = require('../../modules/interactions');
const { WhitelistedMemberChannels, Members } = require('../../constants').Guilds.Remedy;

module.exports = {
    name: 'rankings',
    description: '',
    whitelist: {
        roles: [Members],
        channels: WhitelistedMemberChannels,
    },
    execute(message, member) {
        log.mark('rankings command');
        // TODO priority: high
    },
};