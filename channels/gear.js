const log = require('log4js').getLogger('channels/gear');

const { Collection } = require('discord.js');
const rolecheck = require('../utils/checks').withRoleCheck;
const {
    wDelete,
    wSendAuthor,
    wrapLoading,
    wSendChannel
} = require('../modules/interactions');

const { logToChangelog, fmtdiff } = require('../modules/changelog');

const constants = require('../constants')
const { classlist, horselist, Guilds, gearhelp, classlistSucc, prefix } = constants;
const { gearDeleteTimeout } = constants.Timeouts.gear;
const { helpDeleteTimeout } = constants.Timeouts.gear;

const commands;
const channels = [Guilds.Remedy.gear];
const PrivRoles = [Guilds.Remedy.Officers]

/*
COMMANDS
    !                           DONE
        - DeleteCommand()       DONE
        - wDelete()             DONE
    clearCommand
    RemoveAllCommand
    RemovePlayerCommand
    ManualAddCommand
ACTIONS
    shortUpdateGearCommand      DONE
    help(true) - helpCommand    DONE
    succession - succCommand    DONE
    awakening - awakCommand     DONE
    axe - axeCommand            DONE
    horse - HorseCommand        DONE
    updateGear - updateGearCommand
HANDLER
    - refreshBotMsg             DONE
ETC
    - log to changelog          DONE
    - get changelog             DONE
*/



const actions = new Collection({
    'horse': {
        args: 1,
        execute(m, a) { horseAction(m, a); }
    },
    'gear': {
        execute(m, a) { gear(m, a); } 
    },
    'short': {
        args: 3,
        execute(m, a) { shortAction(m, a) }
    },
    'help': {
        args: 0,
        execute(m, a) { wrapLoading(m, helpAction, m) }
    },
    'axe': {
        args: 1,
        execute(m, a) { axeAction(m, a) }
    },
    'succ': {
        args: 1,
        execute(m, a) { succAction(m, a) }
    },
    'awak': {
        args: 1,
        execute(m, a) { awakAction(m, a) }
    }
});

function getPlayers(message) {
    return message.client.servers.get(message.guild.id).players;
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
    if (!(ap && aap && dp)) {
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
    let help = await wSendChannel(message.channel, gearhelp);
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
    return 'Your class cannot use succession';
}

async function awakAction(message, args) {
    if (classlist.includes(getPlayers.get(message.author).cls)) return foo(message, {succ: false});
    else if (!getPlayers.get(message.author)) return 'You must be registered to use this command';
    else if (!getPlayers.get(message.author).cls) return 'You must register a class before using this command.';
    else return 'Your class cannot use awakening... ?'
}


// async function clearAction(params) {
    
// }

// async function removeAction(params) {
    
// }




/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
const gearChannelHandler = async function (message) {
    let text = message.content;
    let response = '';
    // special case
    if (text.startsWith("! ") && withRoleCheck(message, PrivRoles)) {
        return;
    // command
    } else if (text.startsWith(prefix)) {
        let args = text.slice(prefix.length).trim().split(/ +/);
        let cmd = args.shift().toLowerCase();
        log.mark('gear channel command');
        log.debug(`cmd: ${cmd}`);
        log.debug(`args: ${args}`);

        if (commands.has(cmd)) {
            // clear, removeall, remove, add
            commands.get(cmd).execute(message, args)
        }
        else {
            log.debug('invalid command');
        }
    // action
    } else {
        let args = text.trim().split(/ +/);
        let target = args.length == 3 ? 'short' : args.shift().toLowerCase();
        let action = actions.get(target);
        if (!(target == 'gear') && action) {
            if (action.args == args.length) {
                response = action.execute(message, args)
            } else {
                response = 'invalid argument format';
                if (action.usage) response += usage;
            }
        } else if (classlist.find(c => c == target)) {
            response = actions.get('gear').execute(args)
        } else {
            response = 'invalid command';
        }
    }
    if (response) wSendAuthor(message.author, response);
    await wDelete(message, gearDeleteTimeout);
    //refresh bot message
    message.servers.forEach(server => {
        await refreshBotMsg(server.myGear, server.botMsg, players);
    });
}

module.exports = {
    channels: channels,
    handler: gearChannelHandler,
}
