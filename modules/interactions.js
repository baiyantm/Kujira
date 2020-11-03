// @ts-check
const Discord = require('discord.js');
const logger = require('./logger');

// ------ discord interactions ------

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
        logger.log('EDIT: ' + content + " in " + message.channel);
    } catch (e) {
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
        logger.log("SENT: `" + content + "` in " + channel);
    } catch (e) {
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
        logger.log("SENT: DM to [" + author.tag + " - " + author.id + "]");
    } catch (e) {
        logger.log("INFO: Couldn't send a message to [" + author.tag + " - " + author.id + "]");
    }
    return sent;
}

/**
 * wrapper to delete a message
 * @param {Discord.Message | Discord.PartialMessage} message the message to delete
 */
async function wDelete(message) {
    try {
        await message.delete();
        logger.log("INFO: Deleted `" + message.content + "` from " + message.channel);
    } catch (e) {
        logger.log("INFO: Tried to delete an already deleted message or not enough permissions.");
    }
}

module.exports.wEditMsg = wEditMsg;
module.exports.wSendChannel = wSendChannel;
module.exports.wSendAuthor = wSendAuthor;
module.exports.wDelete = wDelete;