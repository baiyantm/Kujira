const logger = require('./logger');

// ------ discord interactions ------

/**
 * wrapper to edit a bot message
 * @param {message} message the discord message linked
 * @param {string or embed} content the content to send
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
 * @param {channel} channel the discord channel
 * @param {string or embed} content the content to send
 * @returns the message sent
 */
async function wSendChannel(channel, content) {
    var sent;
    try {
        sent = await channel.send(content);
        logger.logToChannel("SENT: `" + content + "` in " + channel, myHistoryChannel);
    } catch (e) {
        logger.logToChannel("INFO: Couldn't send a message in " + channel, myHistoryChannel);
    }
    return sent;
}

/**
 * wrapper to send a bot message to the author
 * @param {author} author the discord author
 * @param {string or embed} content the content to send
 * @returns the message sent
 */
async function wSendAuthor(author, content) {
    var sent;
    try {
        sent = await author.send(content);
        logger.logToChannel("SENT: DM to [" + author.tag + " - " + author.id + "]", myHistoryChannel);
    } catch (e) {
        logger.logToChannel("INFO: Couldn't send a message to [" + author.tag + " - " + author.id + "]", myHistoryChannel);
    }
    return sent;
}

/**
 * wrapper to delete a message
 * @param {message} message the message to delete
 */
async function wDelete(message) {
    try {
        await message.delete();
        logger.log("INFO: Deleted `" + message.content + "` from " + message.channel, myHistoryChannel);
    } catch (e) {
        logger.log("INFO: Tried to delete an already deleted message", myHistoryChannel);
    }
}

module.exports.wEditMsg = wEditMsg;
module.exports.wSendChannel = wSendChannel;
module.exports.wSendAuthor = wSendAuthor;
module.exports.wDelete = wDelete;