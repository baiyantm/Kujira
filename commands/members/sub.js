const log = require('log4js').getLogger('commands/sub');
const interactions = require('../../modules/interactions');
const { WhitelistedMemberChannels, Members } = require('../../constants').Guilds.Remedy;

/**
 * Returns the input string with a Capitalized first letter
 * (no changes if it's already the case)
 * 
 * @param {String} text - the string you want to format
 * @returns {String} The same string, formatted
 */
const title = function (text) {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

module.exports = {
    name: 'sub',
    description: 'subscribe to a ping-role ?',
    whitelist: {
        roles: [Members],
        channels: WhitelistedMemberChannels,
    },
    execute(message, rolename) {
        log.trace(`checking role: ${rolename}`);
        let check = rolename in ['rem', 'reminder', 'dnd'] ? true : false;
        log.trace(`match: ${check}`);
        if (!check) {
            return; // TODO priority: low
        }

        role = message.guild.roles.cache.find(x => x.name == title(rolename))
        if (!role) {
            log.error(`Role ${rolename} not found`);
            return;
        }
        try {
            if (message.member.roles.cache.has(role.id)) {
                log.trace('=> remove role');
                message.member.roles.remove(role);
                interactions.wSendAuthor(message.author, `${role.name} role removed.`);
                log.info(`role ${role.name} removed from ${message.author.tag}`);
            }
            else {
                log.trace('=> add role');
                message.member.roles.add(role);
                interactions.wSendAuthor(message.author, `${role.name} role added.`);
                log.info(`role ${role.name} added to ${message.author.tag}`);
            }
        } catch (e) {
            log.error(e);
            // TODO priority: low
            // role exists, checked at line 27
            // role is self-assignable, checked at line 20
            // what are the real errors? (http timeouts ?)
            interactions.wSendAuthor(message.author, `${rolename} role not found or not self-assignable.`);
        }
    },
};
