const log = require('log4js').getLogger('commands/attendance');
const interactions = require('../../modules/interactions');
const { WhitelistedMemberChannels, Members } = require('../../constants').Guilds.Remedy;

module.exports = {
    name: 'attendance',
    description: '',
    whitelist: {
        roles: [Members],
        channels: WhitelistedMemberChannels,
    },
    execute(message, member) {
        log.mark('attendance command');
        // TODO priority: high
    },
};