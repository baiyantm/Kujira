const log = require('log4js').getLogger('channels/gear');

const { Collection } = require('discord.js');
const { withRoleCheck } = require('../utils/checks');
const {
    wDelete,
    wSendAuthor,
    wrapLoading,
    wSendChannel
} = require('../modules/interactions');

const { logToChangelog, fmtdiff } = require('../modules/changelog');

const {
    classlist,
    classlistSucc,
    horselist,
    gearhelp,
    Timeouts,
    Guilds,
    prefix
} = require('../constants');

const { gearDeleteTimeout, helpDeleteTimeout } = Timeouts.gear;
const channels = [Guilds.Remedy.gear];
const Roles = [Guilds.Remedy.Officers]

/*
COMMANDS
    !                               DONE
        - DeleteCommand()           DONE
        - wDelete()                 DONE
    clearCommand
    RemoveAllCommand
    RemovePlayerCommand
    ManualAddCommand
ACTIONS
    shortUpdateGearCommand          DONE
    help(true) - helpCommand        DONE
    succession - succCommand        DONE
    awakening - awakCommand         DONE
    axe - axeCommand                DONE
    horse - HorseCommand            DONE
    updateGear - updateGearCommand  DONE
HANDLER
    - refreshBotMsg                 DONE
    - sendBotMsg                    DONE
    - PlayerEmbed
    - PlayerEmbed (Alliance)
ETC
    - log to changelog              DONE
    - get changelog                 DONE
*/

// const commands = new Collection([
//     [
//         'gear', {
//             args: 1,
//             execute(m, a) { }
//         }
//     ],
// ])

const actions = new Collection([
    ['horse', {
        args: 1,
        execute(m, a) { horseAction(m, a); }
    }],
    ['gear', {
        execute(m, a) { gearAction(m, a); } 
    }],
    ['short', {
        args: 3,
        execute(m, a) { shortAction(m, a) }
    }],
    ['help', {
        args: 0,
        execute(m, a) { wrapLoading(m, helpAction, m) }
    }],
    ['axe', {
        args: 1,
        execute(m, a) { axeAction(m, a) }
    }],
    ['succ', {
        args: 1,
        execute(m, a) { succAction(m, a) }
    }],
    ['awak', {
        args: 1,
        execute(m, a) { awakAction(m, a) }
    }]
]);

function getPlayers(message) {
    return message.client.getPlayers();
}

async function foo(message, info, allowNew=false) {
    let players = getPlayers(message);
    let before = players.get(message.author.id);
    if (before || allowNew) {
        let after = players.update(message.author.id, info, allowNew);
        if (after) {
            logToChangelog(message, fmtdiff(before, after, info, origin));
        } else {
            log.warn(`error foo ${message.content}`)
            return 'An error occured?';
        }   
    } else {
        return 'You must be registered in order to do this';
    }
}


/**
 * 
 * @param {Discord.Message} message 
 * @param {String[]} args
 */
function shortAction(message, args) {
    let [ ap, aap, dp ] = args.map(arg => parseInt(arg));
    if (!(ap && aap && dp) ||
        !(Number.isInteger(ap) && ap >= 0 && ap < 400 &&
          Number.isInteger(aap) && aap >= 0 && aap < 400 &&
          Number.isInteger(dp) && dp >= 0 && dp < 600)) {
        return 'Invalid Command'
    } else {
        return foo(message, {ap: ap, aap: aap, dp: dp})
    }
}

async function horseAction(message, args) {
    if (horselist.includes(args.toLowerCase())) {
        if (horse == 'none') horse = '';
        return foo(message, {horse: horse})
    } else {
        return 'invalid horse';
    }
}

async function helpAction(message) {
    let help = wSendChannel(message.channel, gearhelp);
    bot.setTimeout(() => {
        wDelete(help);
    }, helpDeleteTimeout);
}


async function axeAction(message, args) {
    let axe;
    if (Number.isInteger(args)) axe = Number(args);
    else {
        switch (args.toLowerCase()) {
            case 'pri': case 'i':   axe = 1; break;
            case 'duo': case 'ii':  axe = 2; break;
            case 'tri': case 'iii': axe = 3; break;
            case 'tet': case 'iv':  axe = 4; break;
            case 'pen': case 'v':   axe = 5; break;
            default: return 'Invalid format'
        }
    }
    return foo(message, {axe: axe});
}

async function succAction(message, args) {
    if (classlistSucc.includes(getPlayers().get(message.author).cls)) return foo(message, {succ: true});
    else if (!getPlayers.get(message.author)) return 'You must be registered to use this command';
    else if (!getPlayers.get(message.author).cls) return 'You must register a class before using this command.';
    else return 'Your class cannot use succession';
}

async function awakAction(message, args) {
    if (classlist.includes(getPlayers.get(message.author).cls)) return foo(message, {succ: false});
    else if (!getPlayers.get(message.author)) return 'You must be registered to use this command';
    else if (!getPlayers.get(message.author).cls) return 'You must register a class before using this command.';
    else return 'Your class cannot use awakening... ?'
}

async function gearAction(message, args) {
    let cls = args.shift();
    let succ = undefined;
    // syntax: class [succ/awak] ap aap dp
    switch (args.length) {
        case 4:
            succ = args.shift().startsWith('succ') ? true : false;
            // fall through
        case 3: break;
        default:
            return 'invalid argument format';
    }
    let [ ap, aap, dp ] = args.map(arg => parseInt(arg));
    if (ap && aap && dp &&
        Number.isInteger(ap) && ap >= 0 && ap < 400 &&
        Number.isInteger(aap) && aap >= 0 && aap < 400 &&
        Number.isInteger(dp) && dp >= 0 && dp < 600) {
        if (succ === undefined) return foo(message, {cls: cls, ap: ap, aap: aap, dp: dp});
        else return foo(message, {cls: cls, succ: succ, ap: ap, aap: aap, dp: dp});
    } else {
        return 'invalid argument format';
    }
}

/**
 * #gear embed
 * @param {?string} origin Discord.Guild.id
 * @returns discord embed
 */
function gearEmbed(client, serverID) {
    // postponed implementation of player filtering by server
    const embed = new Discord.MessageEmbed();
    let players = client.getPlayers();

    embed.setTitle(":star: PLAYERS (" + players.size + ")");
    embed.setColor(3447003);

    let clsmap = new Collection(classlist.map(cls => {
        let clsplayers = players.filter(p => p.cls == cls);
        return [{name: cls, count: clsplayers.size}, {clsplayers}];
    }));

    if (clsmap.size > 0) {
        clsmap.forEach((pls, cls) => {
            if (cls.count > 0) {
                embed.addField(
                    cls.name.charAt(0).toUpperCase() + cls.name.slice(1) + " (" + cls.count + ")\n", 
                    pls.sort().map(p => p.display(true, true, true, true, false)).join('\n'),
                    true);
            }
        });
    } else {
        embed.setDescription("Player list is empty :(");
    }
    return embed;
}
/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
const gearChannelHandler = async function (message) {
    let text = message.content;
    let response = '';

    // Officers can leave comments in the channel by prefixing the message with !
    if (text.startsWith("! ") && withRoleCheck(message, Roles)) {
        return;
    // Officers can use commands to manage players by prefixing the message with ?
    } else if (text.startsWith(prefix) && withRoleCheck(message, Roles)) {
        let args = text.slice(prefix.length).trim().split(/ +/);
        let cmd = args.shift().toLowerCase();
        log.debug(`gear channel command: ${text}`);

        if (commands.has(cmd)) {
            // clear, removeall, remove, add
            commands.get(cmd).execute(message, args)
        }
        else {
            log.debug('invalid command');
        }
    // All other messages are parsed for potential actions
    } else {
        let args = text.trim().split(/ +/);
        let target;
        switch (args.length) {
            case 3: target = 'short'; break;
            case 4: // fall through
            case 5: target = 'gear'; break;
            default:
                target = args.shift().toLowerCase();
                break;
        }
        let action = actions.get(target);
        if (action) {
            // no arg requirement or match arg requirement
            if (!action.args || action.args && action.args == args.length) {
                response = action.execute(message, args)
            } else {
                response = 'invalid argument format';
                if (action.usage) response += usage;
            }
        } else {
            response = 'invalid command';
        }
    }
    if (response) wSendAuthor(message.author, response);
    await wDelete(message, gearDeleteTimeout);
    //refresh bot message
    message.client.servers.forEach(async server => {
        await client.refreshBotMsg(message.channel, gearEmbed(message.client, server.id));
    });
}

module.exports = {
    channels: channels,
    handler: gearChannelHandler,
}
