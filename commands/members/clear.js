const log = require('log4js').getLogger('commands/clear');
const interactions = require('../../modules/interactions');
const { WhitelistedMemberChannels, Members } = require('../../constants').Guilds.Remedy;

module.exports = {
    name: 'clear',
    description: '',
    whitelist: {
        roles: [Members],
        channels: WhitelistedMemberChannels,
    },
    execute(message, member) {
        log.mark('clear command');
        // TODO priority: high
    },
};