const log = require('log4js').getLogger('modules/wars');

const { Collection, Message } = require('discord.js');
const { withRoleCheck } = require('../utils/checks');
const {
    wDelete,
    wSendAuthor,
} = require('../modules/interactions');

const { Guilds, prefix } = require('../constants');
const channels = [Guilds.Remedy.guildwars]

// Commands in this channel (all commands are async)
const commands = new Collection([
    ['clear', {
        refresh: true,
        execute(m, a) { return (await clearCommand(m, a)); }
    }],
    ['load', {
        refresh: true,
        args: 1,
        execute(m, a) { return (await loadCommand(m, a)); }
    }],
    ['parse', {
        refresh: false,
        minargs: 1,
        execute(m, a) { return (await parseCommand(m, a)); }
    }]
])

// Actions in this channel (all actions are sync)
const actions = new Collection([
    ['dec', {
        reg: /^d(e?c{0,2}l?|ec)[a-z]{0,4}$/i,
        refresh: true,
        minargs: 2,
        execute(m, a) { m.client.wars.dec(fmtname(m), a) }
    }],
    ['undec', {
        reg: /^[un](?<=u?)n?de?c{0,2}[a-z]{0,4}$/i,
        refresh: true,
        minargs: 1,
        execute(m, a) { m.client.wars.undec(fmtname(m), a) }
    }]
])

function fmtname(m) {
    return m.author.displayName.split('|')[0];
}


async function parseCommand(msg, args) {
    let res = '';
    args.forEach(id => {
        log.trace(`fetching ${id}`);
        let m = await msg.channel.messages.fetch(id).catch(e => {
            log.error(`Failed to fetch ${id}`, e)
            res += `Failed to fetch ${id} \n`
        });
        if (m) {
            log.debug(`sending ${id}: ${fmtname(m)} > ${m.content}`)
            await guildWarChannelHandler(m)
        }
    })
    return res;
}

async function clearCommand(msg, args) {
    let m = msg.client.botMessages.get(msg.channel);
    if (m) await wDelete(m)
    msg.client.wars.clear(msg)
}

async function loadCommand(msg, args) {
    let res = '';
    let previous = await msg.channel.messages.fetch(args).catch(e => {
        res += `Failed to fetch ${args}, Does it exist?`
        log.warn(`Failed to fetch ${args}`, e)
    })
    if (res) return res
    else return (await msg.client.wars.load(previous));
}

async function refresh(msg) {
    let client = msg.client;

    if (!client.botMessages.has(msg.channel)) {
        let previous = (await client.fetchAllMessages(msg.channel, 20))
            .filter(m => m.author.bot && m.embeds.length == 1)
            .first()
        await client.wars.load(previous)
    }
    await client.refreshBotMsg(msg.channel, client.wars.makeEmbed())
}


/** @param {Message} msg */
const guildWarChannelHandler = async function (msg) {
    let {
        text = msg.content,
        res = '',
        ref = false
    };

    // Officers can leave comments in the channel by prefixing the message with !
    if (text.startsWith('! ') && withRoleCheck(msg, Roles)) {
        return;

    // Channel specific commands
    } else if (text.startsWith(prefix) && withRoleCheck(msg, Roles)) {
        log.debug(`wars channel command: ${text}`)

        let args = text.slice(prefix.length).trim().split(/ +/);
        let cmd = args.shift().toLowerCase();

        if (commands.has(cmd)) {
            res = commands.get(cmd).execute(msg, args)
            ref = commands.get(dmg).refresh
        } else {
            res = 'Invalid command'
        }
    // Channel specific actions
    } else {
        log.debug(`wars channel action: ${text}`)

        let args = text.trim().split(/ +/);
        let key = args.shift();
        let act = actions.find(a => a.test(key))
        
        if (act) {
            if (act.minargs < args.length) {
                res = 'Invalid amount of arguments'
            } else {
                res = actions.get(act).execute(msg, args)
                ref = actions.get(act).refresh
            }
        } else {
            res += 'Invalid command! usage: `[dec|undec] [guildname] [reason]`'
            res += '\nNote that `reason` is obligatory for `dec`, but not for `undec`';
        }
    }

    if (res) wSendAuthor(msg.author, res)
    if (ref) refresh(msg)
    await wDelete(msg)
}

module.exports = {
    channels: channels,
    handler: guildWarChannelHandler,
}
