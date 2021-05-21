const { whitelistCheck } = require('../modules/checks');

const log = require('log4js').getLogger('events/message');

// TODO priority: low
// hook prefix to configfile
const prefix = '?';

// log.info(__filename); // /Users/Zephyro/Documents/code/kujira/events/message.js
// log.info(__dirname); // /Users/Zephyro/Documents/code/kujira/events

module.exports = {
    name: 'message',
    execute(message) {
        if (!message.content.startsWith(prefix) || message.author.bot) return;
        log.debug(`${message.author.tag} in #${message.channel.name} sent: ${message.content}`);

        let args = message.content.slice(prefix.length).trim().split(/ +/);
        let commandName = args.shift().toLowerCase();
        let client = message.client // aka bot

        // is Command ?
        const command = client.commands.get(commandName)
            || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        // do Checks
        if (command.whitelist) {
            if (!whitelistCheck(message, command)) return;
        }

        // check Arguments
        if (command.args && !args.length) {
            if (command.silent) return; // fail silently
            let reply = `You didn't provide any arguments, ${message.author}!`;
            if (command.usage) {
                reply += `\nThe proper useage would be: \`${prefix}${command.name} ${command.usage}\``;
            }
            return message.channel.send(reply);
        }
    
        try {
            command.execute(message, args);
        } catch (error) {
            log.error(error);
        }
    },
};

