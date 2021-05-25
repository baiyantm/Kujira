const log = require('log4js').getLogger('commands/stats');
const interactions = require('../../modules/interactions');
const { WhitelistedMemberChannels, Members } = require('../../constants').Guilds.Remedy;

module.exports = {
    name: 'stats',
    description: '',
    whitelist: {
        roles: [Members],
        channels: WhitelistedMemberChannels,
    },
    execute(message, member) {
        log.mark('stats command');
        // TODO priority: high
    },
};