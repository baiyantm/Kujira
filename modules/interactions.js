const log = require('log4js').getLogger('modules/interactions');

const {
    User,
    GuildMember,
    Message,
    PartialMessage,
    MessageEmbed,
    GuildChannel,
    TextChannel,
    DMChannel,
    NewsChannel
} = require('discord.js');

const { startLoading, endLoading } = require('../utils/messages');

// ------ discord interactions ------

/**
 * Wrapper for start/end loading
 * 
 * @param {Function} fn 
 * @returns 
 */
async function wrapLoading(message, fn, ...args) {
    startLoading(message);
    fn(...args);
    endLoading(message, 0);
}

/**
 * Wrapper to safely edit a bot message
 * 
 * @param {Message} message the discord message linked
 * @param {String | MessageEmbed} content the content to send
 * @returns {?Boolean} whether the message got edited
 */
async function wEditMsg(message, content) {
    var edit = true;
    if (!message instanceof Message) {
        log.error(`wEdit expected a Message, but got ${typeof message}: ${message}`);
        return false;
    }
    try {
        await message.edit(content);
        let name = message.channel.toString();
        if(message.channel instanceof GuildChannel) {
            name = message.channel.name;
        }
        log.info('EDIT: ' + content + " in " + name);
    } catch (e) {
        log.error(`Couldn't edit the message ${message.id} ${e}`);
        edit = false;
    }
    return edit;
}


/**
 * wrapper to safely send a bot message to a channel
 * 
 * @param {TextChannel | DMChannel | NewsChannel} channel The discord channel
 * @param {String | MessageEmbed} content The content to send
 * @returns {?Message} The message sent
 */
async function wSendChannel(channel, content) {
    var sent;
    if (!(channel instanceof TextChannel || channel instanceof NewsChannel || channel instanceof DMChannel)) {
        log.error(`wSendChannel expected a Channel, but got ${typeof channel}`)
    } else {
        if (channel instanceof DMChannel) {
            log.warn(`Using wSendChannel for DMs is discouraged, use wSendAuthor`);
        }
        try {
            sent = await channel.send(content);
            let name = channel.toString();
            if(channel instanceof GuildChannel) {
                name = channel.name;
            }
            logger.log("SENT: `" + content + "` in " + name);
        } catch (e) {
            console.error(e);
            log.info("Couldn't send a message in " + channel);
        }
    }
    return sent;
}

/**
 * Wrapper to safely send a bot message to the author
 * 
 * @param {User | GuildMember} author The discord User or Member to dm
 * @param {String | MessageEmbed} content The content to send
 * @returns {?Message} The message sent
 */
async function wSendAuthor(author, content) {
    var sent;
    if (!(author instanceof User || author instanceof GuildMember)) {
        log.error(`wSendAuthor expected GuildMember|User, but instead got ${typeof author}`);
    } else {
        try {
            sent = await author.send(content);
            log.info("SENT: DM to [" + author.tag + " - " + author.id + "]");
        } catch (e) {
            log.error("Couldn't send a message to [" + author.tag + " - " + author.id + `]\n${e}`);
        }
    }
    return sent;
}

/**
 * Wrapper to safely delete a message
 * 
 * @param {Message | PartialMessage} message the message to delete
 */
async function wDelete(message, timeout=0) {
    try {
        await message.delete({timeout: timeout});
        let name = message.channel.toString();
        if(message.channel instanceof GuildChannel) {
            name = message.channel.name;
        }
        log.info("Deleted `" + message.content + "` from " + name);
    } catch (e) {
        log.error(`Failed to delete message!\n${e}`);
    }
}

module.exports.wEditMsg = wEditMsg;
module.exports.wSendChannel = wSendChannel;
module.exports.wSendAuthor = wSendAuthor;
module.exports.wDelete = wDelete;
module.exports.wrapLoading = wrapLoading;
