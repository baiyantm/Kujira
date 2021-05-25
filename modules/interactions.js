// @ts-check
const Discord = require('discord.js');
const logger = require('./logger');
const log = require('log4js').getLogger('modules/interactions');
const { startLoading, endLoading } = require('../utils/messages');

// ------ discord interactions ------

/**
 * Wrapper for start/end loading
 * @param {Function} fn 
 * @returns 
 */
async function wrapLoading(message, fn, ...args) {
    startLoading(message);
    fn(...args);
    endLoading(message, 0);
}

/**
 * wrapper to edit a bot message
 * @param {Discord.Message} message the discord message linked
 * @param {string | Discord.MessageEmbed} content the content to send
 * @returns whether the message got edited
 */
async function wEditMsg(message, content) {
    var edit = true;
    try {
        await message.edit(content);
        let name = message.channel.toString();
        if(message.channel instanceof Discord.GuildChannel) {
            name = message.channel.name;
        }
        logger.log('EDIT: ' + content + " in " + name);
    } catch (e) {
        console.error(e);
        logger.log("INFO: Couldn't edit the message");
        edit = false;
    }
    return edit;
}


/**
 * wrapper to send a bot message to a channel
 * @param {Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel} channel the discord channel
 * @param {string | Discord.MessageEmbed} content the content to send
 * @returns the message sent
 */
async function wSendChannel(channel, content) {
    var sent;
    try {
        sent = await channel.send(content);
        let name = channel.toString();
        if(channel instanceof Discord.GuildChannel) {
            name = channel.name;
        }
        logger.log("SENT: `" + content + "` in " + name);
    } catch (e) {
        console.error(e);
        logger.log("INFO: Couldn't send a message in " + channel);
    }
    return sent;
}

/**
 * wrapper to send a bot message to the author
 * @param {Discord.User} author the discord author
 * @param {string | Discord.MessageEmbed} content the content to send
 * @returns the message sent
 */
async function wSendAuthor(author, content) {
    var sent;
    try {
        sent = await author.send(content);
        log.info("SENT: DM to [" + author.tag + " - " + author.id + "]");
    } catch (e) {
        log.error("INFO: Couldn't send a message to [" + author.tag + " - " + author.id + `]\n${e}`);
    }
    return sent;
}

/**
 * wrapper to delete a message
 * @param {Discord.Message | Discord.PartialMessage} message the message to delete
 */
async function wDelete(message, timeout=0) {
    try {
        await message.delete({timeout: timeout});
        let name = message.channel.toString();
        if(message.channel instanceof Discord.GuildChannel) {
            name = message.channel.name;
        }
        log.info("Deleted `" + message.content + "` from " + name);
    } catch (e) {
        log.error(`Tried to delete an already deleted message or not enough permissions. \n${e}`);
    }
}

module.exports.wEditMsg = wEditMsg;
module.exports.wSendChannel = wSendChannel;
module.exports.wSendAuthor = wSendAuthor;
module.exports.wDelete = wDelete;
module.exports.wrapLoading = wrapLoading;
