const log = require('log4js').getLogger('checks');

// For typedefs ...
const Discord = require('discord.js');

/**
* @param {Discord.Message} message The message that we are checking
* @param {String} commandName Name of the command
* @param {String[]} roles List of discord role ids
* @returns {Boolean} - if the check is passed or not 
*/
const withRoleCheck = function (message, commandName, roles) {
   if (message.channel.type === 'dm') {
       log.debug(`${message.author.tag} tried to use the \'${commandName}\' command ` +
                 `from a DM.\nThis command is restricted by the withRoleCheck. Rejecting.`
       );
       return false;
   }
   for (role of roles) {
       log.trace(role);
       if (message.member.roles.cache.has(role)) return true;
   }

   log.trace(`${message.author.tag} does not have the required role to use the ` +
             `${commandName} command, so the request is rejected.`
   );
   return false;
}

/**
 * @param {Discord.Message} message The message that we are checking
 * @param {String} commandName Name of the command
 * @param {String[]} channels List of channel ids
 * @returns {Boolean} - if the check is passed or not
 */
const inChannelCheck = function (message, commandName, channels) {
    for (channel of channels) {
        if (message.channel.id == channel) return true;
    }
    log.trace(`${message.author.tag} tried to use the \'${command}\' in the blacklisted ` +
              `channel ${message.channel.name}. Rejecting.`
    );
}


module.exports = {
    /**
     * @param {Discord.Message} message The message that we are checking
     * @param {Object} command The command that is being issued
     * @returns {Boolean} - true if all checks pass, false otherwise
     */
    whitelistCheck(message, command) {
        // TODO priority: low
        // add functionality for replies to failed commands
        // "Permission denied"
        const { roles, channels } = command.whitelist;
        if (roles) {
            if (!withRoleCheck(message, command.name, roles)) {
                return false;
            }
        }
        if (channels) {
            if (!inChannelCheck(message, command.name, channels)) {
                return false;
            }
        }
        return true;
    }
}
