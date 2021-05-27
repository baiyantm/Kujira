const log = require('log4js').getLogger('events/message');

const { readdirSync } = require('fs');
const { whitelistCheck } = require('../utils/checks');
const { prefix } = require('../constants');

const handlers = new Map();

for (let f of readdirSync('./channels')) {
    let h = require(`../channels/${f}`);
    for (let c of h.channels) {
        handlers.set(c, h.handler);
    }
}

module.exports = {
    name: 'message',
    execute(message, client) {

        // Channel handlers
        if (message.channel && handlers.has(message.channel.id)) {
            return handlers.get(message.channel.id)(message);
        }

        // Do not handle other bot messages;
        if (message.author.bot) return;

        // Do not handle normal messages;
        if (!message.content.startsWith(prefix)) return;

        log.debug(`${message.author.tag} in ${message.channel.name} sent: ${message.content}`);

        let args = message.content.slice(prefix.length).trim().split(/ +/);
        let commandName = args.shift().toLowerCase();

        // get command
        const command = client.commands.get(commandName)
            || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        // do Checks
        if (command.whitelist) {
            if (!whitelistCheck(message, command)) return;
        }

        // also check Arguments
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
