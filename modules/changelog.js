const log = require('log4js').getLogger('modules/changelog');
const { Guilds } = require('../constants');

const fmtdiff = function (before, after, info, origin) {
    if (before && after) {
        strategySwitcher(info)(before, after, origin);
    } else if (before) {
        logToChangelog(fmtRemovedPlayer(before));
    } else if (after) {
        logToChangelog(fmtNewPlayer(after));
    }
}

// let content = "> Updated " + playerFound.getNameOrMention() + "'s axe :\n" + oldAxe + " -> " + playerFound.getAxe(true);

const logToChangelog = async function (message, content) {
    let changelog = Guilds[message.guild.id].changelog;
    if (!changelog) {
        log.error(`changelog not configured for this server! ${message.guild.id}`);
        return;
    }
    let channel = message.client.channels.cache.get(changelog);
    if (!channel) channel = await message.client.channels.fetch(changelog);
    if (!channel) {
        log.error(`could not aquire changelog ${changelog}`);
        return;
    }
    await channel.send(content);
}

function strategySwitcher(info) {
    // assume normal update
    if (info.cls) return fmtClassUpdate;
    else if (info.succ) return fmtSuccUpdate;
    else if (info.horse) return fmtHorseUpdate;
    else return fmtGearUpdate;
}

function fmtNewPlayer(after, source) {
    let text = '';
    text += '> New player\n';
    text += after.display(true, true, true, true, true);
    text += '\n';
    text += '(Command issuer: ' + source.toString() + ')';
    return text;
}

function fmtRemovedPlayer(before, source) {
    let text = '';
    text += before.display(true, true, true, true, true);
    text += '\nRemoved from gear list.';
    text += '\n(Command issuer: ' + source.toString() + ')';
}

function fmtGearUpdate(before, after, source) {
    let text = '';
    text += `> Updated ${after.mention()}\'s gear:\n`;
    text += fmtField('Class : ', before.cls, after.cls);
    let stats = '';
    for (let field of ['ap', 'aap', 'dp']) {
        stats += fmtField(field, before, after);
    }
    if (stats != "") {
        text += "```ml\n" + stats + "```";
    }
    text += '(Command issuer: ' + source.toString() + ')';
    return text;
}

/** @param {String} field */
function fmtField(field, before, after) {
    let v1 = before[field];
    let v2 = after[field];
    let text = ''
    if (v1 != v2) {
        text += `${field.padEnd(4, " ")}: ${v1} -> ${v2}`
        let iv1 = parseInt(v1);
        let iv2 = parseInt(v2);
        if (iv1 && iv2) {
            let idiff = parseInt(v2) - parseInt(v1);
            if (idiff != 0) text += '('
            if (idiff < 0) text += '-'
            if (idiff > 0) text += '+'
            if (idiff != 0) text += ')\n'
        }
    }
    return text;
}

module.exports = {
    fmtdiff, logToChangelog
}