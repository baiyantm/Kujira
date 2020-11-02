// @ts-check
const Discord = require('discord.js');
const fs = require('fs');
const { parse } = require('json2csv');
const files = require("./modules/files");
const interactions = require("./modules/interactions");
const logger = require("./modules/logger");
const util = require("./modules/util");
const Player = require('./classes/Player');
const PlayerArray = require('./classes/PlayerArray');

async function initLookout() {
    bot.user.setPresence({ activity: { name: 'up', type: "PLAYING" } });

    if (myAnnouncement) {
        setupPresence();
    }

    if (myGuildChat) {
        setupAlarms();
    }

    if (myServer) {
        setupCustomAlarms();
    }

    var annCache = { reference: null }; //because JavaScript
    await cacheAnnouncements(annCache);
    annCache.reference.forEach(async message => {
        try {
            await downloadFilesFromMessage(message);
        } catch (e) {
            //nothing to dl
        }
    });

    var botMsg = { reference: null }; //because JavaScript
    //lookup for a previous message so we keep using it
    await myGear.messages.fetch({ limit: 100 }).then(messages => {
        var found = 0;
        messages.forEach(message => {
            if (message.author.id == bot.user.id) {
                if (!found) {
                    botMsg.reference = message;
                    logger.log("INFO: Found an existing message, keeping it and refreshing it.");
                    found++;
                } else if (found == 1) {
                    botMsg.reference = null;
                    logger.log("INFO: Found multiple existing messages, aborting and generating a new one instead.");
                    found++;
                }
            }
        });
    });

    await refreshBotMsg(myGear, botMsg, players);

    bot.on("guildMemberRemove", member => onLeaveHandler(member));

    bot.on("message", async message => onMessageHandler(message, botMsg, annCache));

    bot.on("messageReactionAdd", async (messageReaction, user) => onReactionAddHandler(messageReaction, user));

    bot.on("messageReactionRemove", async (messageReaction, user) => onReactionRemoveHandler(messageReaction, user));

    // @ts-ignore
    bot.on("messageUpdate", async (oldMessage, newMessage) => onEditHandler(newMessage, annCache));

    bot.on("messageDelete", async deletedMessage => onDeleteHandler(deletedMessage, annCache));

    bot.on('raw', packet => {
        // We don't want this to run on unrelated packets
        if (!['MESSAGE_REACTION_ADD'].includes(packet.t) && !['MESSAGE_UPDATE'].includes(packet.t)
            && !['MESSAGE_DELETE'].includes(packet.t)) {
            return;
        } else {
            if (['MESSAGE_REACTION_ADD'].includes(packet.t)) {
                // Grab the channel to check the message from
                const channel = bot.channels.cache.get(packet.d.channel_id);
                // There's no need to emit if the message is cached, because the event will fire anyway for that
                // @ts-ignore
                if (channel.messages.cache.has(packet.d.message_id)) return;
                // Since we have confirmed the message is not cached, let's fetch it
                // @ts-ignore
                channel.messages.fetch(packet.d.message_id).then(message => {
                    // Emojis can have identifiers of name:id format, so we have to account for that case as well
                    const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
                    // This gives us the reaction we need to emit the event properly, in top of the message object
                    const reaction = message.reactions.cache.get(emoji);
                    // Adds the currently reacting user to the reaction's users collection.
                    if (reaction) reaction.users.cache.set(packet.d.user_id, bot.users.cache.get(packet.d.user_id));
                    // Check which type of event it is before emitting
                    bot.emit('messageReactionAdd', reaction, bot.users.cache.get(packet.d.user_id));
                });
            } else if (['MESSAGE_REACTION_REMOVE'].includes(packet.t)) {
                // Grab the channel to check the message from
                const channel = bot.channels.cache.get(packet.d.channel_id);
                // There's no need to emit if the message is cached, because the event will fire anyway for that
                // @ts-ignore
                if (channel.messages.cache.has(packet.d.message_id)) return;
                // Since we have confirmed the message is not cached, let's fetch it
                // @ts-ignore
                channel.messages.fetch(packet.d.message_id).then(message => {
                    // Emojis can have identifiers of name:id format, so we have to account for that case as well
                    const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
                    // This gives us the reaction we need to emit the event properly, in top of the message object
                    const reaction = message.reactions.cache.get(emoji);
                    // Adds the currently reacting user to the reaction's users collection.
                    if (reaction) reaction.users.cache.set(packet.d.user_id, bot.users.cache.get(packet.d.user_id));
                    // Check which type of event it is before emitting
                    bot.emit('messageReactionRemove', reaction, bot.users.cache.get(packet.d.user_id));
                });
            } else if (['MESSAGE_UPDATE'].includes(packet.t)) {
                const channel = bot.channels.cache.get(packet.d.channel_id);
                // There's no need to emit if the message is cached, because the event will fire anyway for that
                // @ts-ignore
                if (channel.messages.cache.has(packet.d.id)) return;
                // Since we have confirmed the message is not cached, let's fetch it
                // @ts-ignore
                channel.messages.fetch(packet.d.id).then(message => {
                    bot.emit('messageUpdate', null, message);
                });
            } else if (['MESSAGE_DELETE'].includes(packet.t)) {
                const channel = bot.channels.cache.get(packet.d.channel_id);
                // There's no need to emit if the message is cached, because the event will fire anyway for that
                // @ts-ignore
                if (channel.messages.cache.has(packet.d.id)) return;
                // Since we have confirmed the message is not cached, let's fetch it
                bot.emit('messageDelete', { channel: { id: packet.d.channel_id }, id: packet.d.id });
            }
        }
    });

    if (myGear.id && myGearData.id) {
        bot.setInterval(async () => {
            await savePlayers();
        }, configjson["saveDelay"]);
    }

    if (mySignUp.id && mySignUpData.id) {
        setupSignUpSchedule();
        await collectSignUps();
        bot.setInterval(async () => {
            await collectSignUps();
        }, configjson["signupDelay"]);
    }

    process.on('SIGTERM', async function () {
        logger.log("Recieved signal to terminate, saving and shutting down");
        if (myGear.id && myGearData.id) {
            await savePlayers();
        }
        await bot.destroy();
        process.exit(0);
    });

    logger.log("INFO: Initialization done");
}

/**
 * listener for member leaving guild
 * @param {Discord.GuildMember | Discord.PartialGuildMember} member 
 */
async function onLeaveHandler(member) {
    if (member.guild.id == myServer.id) {
        interactions.wSendChannel(myWelcome, member.toString + "(" + member.user.username + ") has left the server.");
    } else if (member.guild.id == myTrialServer.id) {
        interactions.wSendChannel(myTrialWelcome, member.toString + "(" + member.user.username + ") has left the server.");
    }
}

/**
 * listener for message edit
 * @param {Discord.Message | Discord.PartialMessage} newMessage 
 * @param {{reference : any}} annCache 
 */
async function onEditHandler(newMessage, annCache) {
    if (newMessage.channel.id == myAnnouncement.id) {
        await cacheAnnouncements(annCache);
    }
}

/**
 * listener for message delete
 * @param {Discord.Message | Discord.PartialMessage} deletedMessage 
 * @param {{reference : any}} annCache 
 */
async function onDeleteHandler(deletedMessage, annCache) {
    try {
        if (deletedMessage.channel.id == myAnnouncement.id) {
            await interactions.wSendChannel(myAnnouncementData, await getHistoryEmbed(deletedMessage));
            await cacheAnnouncements(annCache);
        }
    } catch (e) {
        logger.logError("ERROR : Delete event caching problem", e);
    }
}

/**
 * listener for emoji add event
 * @param {Discord.MessageReaction} messageReaction 
 * @param {Discord.User | Discord.PartialUser} user 
 */
async function onReactionRemoveHandler(messageReaction, user) {
    if (messageReaction.message.channel.id == myTrial.id) {
        await trialReactionRemoveHandler(messageReaction, user);
    }
}

/**
 * listener for emoji add event
 * @param {Discord.MessageReaction} messageReaction 
 * @param {Discord.User | Discord.PartialUser} user 
 */
async function onReactionAddHandler(messageReaction, user) {
    if (messageReaction.message.channel.id == mySignUp.id) {
        signUpReactionAddHandler(messageReaction, user);
    } else if (messageReaction.message.channel.id == myTrial.id) {
        trialReactionAddHandler(messageReaction, user);
    }
}

/**
 * listener for emoji add event on trial channel
 * @param {Discord.MessageReaction} messageReaction 
 * @param {Discord.User | Discord.PartialUser} user  
 */
async function trialReactionAddHandler(messageReaction, user) {
    if ("⚔️" == messageReaction.emoji.name) {
        const guild = messageReaction.message.guild;
        const guildMember = guild.members.cache.get(user.id);
        if (!guildMember.roles.cache.find(x => x.name == "Officer")) {
            const roleIndex = await getNextTrialRoleIndex(guild);
            const role = guild.roles.cache.find(x => x.name == "Trial " + roleIndex);
            const channel = guild.channels.cache.find(x => x.name == "trial-" + roleIndex);
            try {
                // @ts-ignore
                await historizeChannel(channel, myTrialHistory);

                await guildMember.roles.add(role);
                await guildMember.roles.add(guild.roles.cache.find(x => x.name == "Trialee"));
                await interactions.wSendChannel(channel, user.toString() + " Hi, please post your gear screenshot here in this format: https://imgur.com/a/eYiNNgd")
            } catch (e) {
                console.error(e);
                logger.log("ERROR: Couldn't add " + role.name + " to " + guildMember.user.tag);
            }
        }
    }
}

/**
 * gets the next trial role, if not available, creates it
 * @param {Discord.Guild} guild 
 */
async function getNextTrialRoleIndex(guild) {
    let available = false;
    let roleCount = 1;
    let trialRole;
    while (!available) {
        let roleName = "Trial " + roleCount;
        trialRole = guild.roles.cache.find(x => x.name == roleName);
        if (trialRole != undefined) {
            available = isTrialRoleAvailable(guild, trialRole);
            if (!available) {
                roleCount++;
            }
        } else {
            await createNewTrialChannelAndRole(guild, roleCount, trialRole, roleName);
            available = true;
        }
    }
    return roleCount;
}

async function createNewTrialChannelAndRole(guild, roleCount, trialRole, roleName) {
    let lastTrialChannel = guild.channels.find(channel => channel.name.startsWith("trial-" + (roleCount - 1)));
    let newTrialChannel = await lastTrialChannel.clone({
        name: "trial-" + roleCount,
        permissionOverwrites: lastTrialChannel.permissionOverwrites
    });
    newTrialChannel.edit({
        position: lastTrialChannel.position + 1
    });
    let lastTrialRole = guild.roles.find(x => x.name == "Trial " + (roleCount - 1));
    trialRole = await guild.createRole({
        name: roleName,
        position: lastTrialRole.position - 1,
        permissions: lastTrialRole.permissions
    });
    newTrialChannel.overwritePermissions(trialRole, {
        VIEW_CHANNEL: true,
        SEND_MESSAGES: true,
        EMBED_LINKS: true,
        ATTACH_FILES: true,
        READ_MESSAGE_HISTORY: true,
        USE_EXTERNAL_EMOJIS: true,
        ADD_REACTIONS: true
    });
    newTrialChannel.permissionOverwrites.get(lastTrialRole.id).delete();
    return trialRole;
}

/**
 * gets the next trial role, if not available, creates it
 * @param {Discord.Guild} guild 
 */
function isTrialRoleAvailable(guild, role) {
    let available = true;
    guild.members.cache.forEach(member => {
        if (member.roles.cache.has(role.id)) {
            available = false;
        }
    });
    return available;
}

/**
 * listener for emoji add event on trial channel
 * @param {Discord.MessageReaction} messageReaction 
 * @param {Discord.User | Discord.PartialUser} user 
 */
async function trialReactionRemoveHandler(messageReaction, user) {
    if ("⚔️" == messageReaction.emoji.name) {
        const guildMember = messageReaction.message.guild.members.cache.get(user.id);
        if (!guildMember.roles.cache.find(x => x.name == "Officer")) {
            guildMember.roles.cache.forEach(role => {
                if (role.name.startsWith("Trial")) {
                    try {
                        guildMember.roles.remove(role);
                    } catch (e) {
                        logger.log("ERROR: Failed to remove role \"" + role + "\"");
                    }
                }
            });
        }
    }
}

/**
 * listener for emoji add event on signup channel
 * @param {Discord.MessageReaction} messageReaction 
 * @param {Discord.User | Discord.PartialUser} user 
 */
async function signUpReactionAddHandler(messageReaction, user) {
    let message = messageReaction.message;
    let yesReaction = message.reactions.cache.filter(messageReaction => messageReaction.emoji.name == configjson["yesreaction"]).first();
    let noReaction = message.reactions.cache.filter(messageReaction => messageReaction.emoji.name == configjson["noreaction"]).first();
    if (messageReaction.emoji.name == configjson["noreaction"]) {
        if (user.id != bot.user.id && (await noReaction.fetch()).users.cache.get(user.id)) {
            if (yesReaction) {
                // @ts-ignore
                yesReaction.users.remove(user);
            }
        }
    }
    if (messageReaction.emoji.name == configjson["yesreaction"]) {
        if (user.id != bot.user.id && (await yesReaction.fetch()).users.cache.get(user.id)) {
            if (noReaction) {
                // @ts-ignore
                noReaction.users.remove(user);
            }
        }
    }
}

/**
 * listener for message event
 * @param {Discord.Message | Discord.PartialMessage} message the message sent
 * @param {Object} botMsg reference to the bot message
 * @param {{reference : any}} annCache 
 */
async function onMessageHandler(message, botMsg, annCache) {
    //if (message.author.bot) return; //bot ignores bots
    var commands;
    let enteredCommand = message.content.toLowerCase();
    try {
        if (message.channel.id == myAnnouncement.id) {
            await cacheAnnouncements(annCache);
            if (message.attachments.size > 0) {
                await downloadFilesFromMessage(message);
            }
        } else if (message.channel.id == myGate.id) {
            // === GATE ===
            commands = itemsjson["commands"]["gate"]["guest"];
            await gateChannelHandler(commands, enteredCommand, message);
        } else if (message.channel.id == mySignUp.id) {
            // === SIGNUP ===
            await signupChannelHandler(enteredCommand, message, commands);
        } else if (message.channel.id == myGear.id) {
            // === GEAR ===
            await gearChannelHandler(enteredCommand, message, commands, botMsg);
        } else if (message.channel.id == mySignUpData.id) {
            // === SIGNUP DATA ===
            await signupDataChannelHandler(enteredCommand, message, commands);
        } else {
            // === ALL CHANNELS ===
            if (enteredCommand.startsWith("?")) {
                await allChannelsHandler(enteredCommand, commands, message);
            }
        }
    } catch (e) {
        logger.logError("On message listener error. Something really bad went wrong", e);
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function signupDataChannelHandler(enteredCommand, message, commands) {
    if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
        commands = itemsjson["commands"]["signup"]["adv"];
        enteredCommand = enteredCommand.substr(1);
        let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
        enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
        if (enteredCommand == commands["dump"]) {
            await dumpCommand(message, args);
        }
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function gateChannelHandler(commands, enteredCommand, message) {
    if (enteredCommand == commands["ok"]) {
        await okCommand(message);
    }
    deleteCommand(message);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function okCommand(message) {
    let publicRole = message.guild.roles.cache.find(x => x.name == "Public");
    if (!message.member.roles.cache.has(publicRole.id)) {
        await message.member.roles.add(publicRole);
        logger.log("ROLE: " + publicRole + " role added to " + message.author.tag);
        await interactions.wSendAuthor(message.author, itemsjson["urlguildpage"]);
        await interactions.wSendAuthor(message.author, itemsjson["gateguide"] + "\n\nReminder that you agreed to the following rules :\n" + itemsjson["gaterules"]);
        await interactions.wSendChannel(myWelcome, message.author + " agreed to the rules and got the public role.");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function signupChannelHandler(enteredCommand, message, commands) {
    if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
        commands = itemsjson["commands"]["signup"]["adv"];
        enteredCommand = enteredCommand.substr(1);
        let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
        enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
        if (enteredCommand == commands["clear"]) {
            await clearCommand(message);
        }
        else if (enteredCommand == commands["reset"]) {
            await resetCommand(message, args);
        }
        else if (enteredCommand == commands["dump"]) {
            //manually dumps data into data channel
            await dumpCommand(message, args);
        }
        else if (enteredCommand == commands["generate"]) {
            await generateCommand(message, args);
        }
        else if (enteredCommand == commands["react"]) {
            await reactCommand(message);
        }
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
// @ts-ignore
async function resetCommand(message, args) {
    await clearChannel(message.channel);
    await generateSignUpMessages(configjson["defaultCount"]);
    players.resetPlayersSignUps();
}

/**
 * 
 * @param {Discord.Message | Discord.PartialMessage} message 
 * @param {*} args 
 */
// @ts-ignore
async function dumpCommand(message, args) {
    startLoading(message);
    await collectSignUps();
    await dumpSignUps();
    endLoading(message, 0);
    deleteCommand(message);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function generateCommand(message, args) {
    deleteCommand(message);
    if (Number(args) <= 14) {
        await generateSignUpMessages(args ? args : configjson["defaultCount"]);
    }
    else {
        interactions.wSendAuthor(message.author, "I cannot generate that many messages");
    }
    players.resetPlayersSignUps();
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function reactCommand(message) {
    await message.channel.messages.fetch({ limit: 2 }).then(async (messages) => {
        let toReact = messages.last();
        await toReact.react(configjson["yesreaction"]);
        await toReact.react(configjson["noreaction"]);
    });
    await deleteCommand(message);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function gearChannelHandler(enteredCommand, message, commands, botMsg) {
    if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
        commands = itemsjson["commands"]["gear"]["adv"];
        enteredCommand = enteredCommand.substr(1); // remove ?
        let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
        enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
        if (enteredCommand == commands["clear"]) {
            await clearCommand(message);
        }
        else if (enteredCommand == commands["removeall"]) {
            removeAllCommand();
        }
        else if (enteredCommand == commands["remove"]) {
            await removePlayerCommand(message, args);
        }
        else if (enteredCommand == commands["add"]) {
            await manualAddCommand(args, message, commands);
        }
    }
    else if (!enteredCommand.startsWith("! ") && !enteredCommand.startsWith("?")) {
        let classToFind = itemsjson["classlist"].find(currentclassname => currentclassname == enteredCommand.split(" ")[0]);
        let firstSplit = enteredCommand.split(" ");
        if (firstSplit.length == 3) {
            await shortUpdateGearCommand(message, firstSplit);
        }
        else {
            let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase(); // all but first word
            let split = args.split(" ");
            enteredCommand = enteredCommand.split(" ")[0]; // only first word
            commands = itemsjson["commands"]["gear"]["guest"];
            if (enteredCommand == commands["help"]) {
                await helpCommand(message, true);
            }
            else if (enteredCommand == commands["succession"]) {
                await succCommand(message);
            }
            else if (enteredCommand == commands["awakening"]) {
                await awakCommand(message);
            }
            else if (enteredCommand == commands["axe"]) {
                await axeCommand(split, message, args);
            }
            else if (classToFind) {
                await updateGearCommand(split, commands, classToFind, message);
            }
            else {
                interactions.wSendAuthor(message.author, enteredCommand + " class not found.\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
            }

        }
    }
    deleteCommand(message);

    //refresh bot message
    bot.setTimeout(async () => {
        await refreshBotMsg(myGear, botMsg, players);
    }, configjson["refreshDelay"]);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function clearCommand(message) {
    await clearChannel(message.channel);
}

function removeAllCommand() {
    players.length = 0;
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function removePlayerCommand(message, args) {
    let playerId = "";
    if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
        playerId = message.mentions.members.first().id;
    }
    else {
        playerId = args;
    }
    await removePlayer(players, playerId, message.author);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function helpCommand(message, deletion) {
    startLoading(message);
    let helpMessage = await interactions.wSendChannel(message.channel, itemsjson["gearhelp"]);
    if (deletion) {
        bot.setTimeout(() => {
            interactions.wDelete(helpMessage);
        }, 60000);
    }
    endLoading(message, 0);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function manualAddCommand(args, message, commands) {
    let split = args.split(" ");
    if (split.length >= 5) {
        let member = null;
        if (message.mentions.members.size == 1) {
            member = message.mentions.members.first();
        }
        let name = split[0];
        split.splice(0, 1); // remove name
        let classToFind = itemsjson["classlist"].find(currentclassname => currentclassname == split[0]);
        if (classToFind) {
            split.splice(0, 1); // remove classname
            split[0].startsWith(split[0]);
            let succ = null;
            if (split.length == 4) {
                if (split[0].startsWith(commands["succession"]) &&
                    itemsjson["classlistSucc"].find(currentclassname => currentclassname == classToFind)) {
                    succ = true;
                }
                else if (split[0].startsWith(commands["awakening"])) {
                    succ = false;
                }
                split.splice(0, 1); // remove succ
            }
            let ap = parseInt(split[0]);
            let aap = parseInt(split[1]);
            let dp = parseInt(split[2]);
            if (Number.isInteger(ap) && ap >= 0 && ap < 400 && Number.isInteger(aap) && aap >= 0 && aap < 400 && Number.isInteger(dp) && dp >= 0 && dp < 600) {
                let player;
                if (!member) {
                    player = new Player(name, classToFind, ap, aap, dp, false);
                }
                else {
                    player = new Player(member, classToFind, ap, aap, dp, true);
                }
                await updatePlayer(players, player, succ, message.author);
            }
            else {
                interactions.wSendAuthor(message.author, "Some stats are too high or not numbers.");
            }
        }
        else {
            interactions.wSendAuthor(message.author, split[0] + " class not found.\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
        }
    }
    else {
        interactions.wSendAuthor(message.author, "Incorrect format. Correct format is `<name> <classname> [succession|awakening] <ap> <aap> <dp>`\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function shortUpdateGearCommand(message, firstSplit) {
    let playerToFind = players.get(message.author.id);
    let ap = parseInt(firstSplit[0]);
    let aap = parseInt(firstSplit[1]);
    let dp = parseInt(firstSplit[2]);
    if (playerToFind && Number.isInteger(ap) && ap >= 0 && ap < 400 && Number.isInteger(aap) && aap >= 0 && aap < 400 && Number.isInteger(dp) && dp >= 0 && dp < 600) {
        let player = new Player(message.member, playerToFind.classname, ap, aap, dp, true);
        await updatePlayer(players, player, null, message.author);
    }
    else {
        interactions.wSendAuthor(message.author, "Invalid command. Not registered to update stats.");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function updateGearCommand(split, commands, classToFind, message) {
    let succ = null;
    if (split.length == 4) {
        if (split[0].startsWith(commands["succession"]) &&
            itemsjson["classlistSucc"].find(currentclassname => currentclassname == classToFind)) {
            succ = true;
        }
        else if (split[0].startsWith(commands["awakening"])) {
            succ = false;
        }
        split.splice(0, 1); // remove succ
    }
    if (split.length == 3) {
        let ap = parseInt(split[0]);
        let aap = parseInt(split[1]);
        let dp = parseInt(split[2]);
        if (Number.isInteger(ap) && ap >= 0 && ap < 400 && Number.isInteger(aap) && aap >= 0 && aap < 400 && Number.isInteger(dp) && dp >= 0 && dp < 600) {
            let player = new Player(message.member, classToFind, ap, aap, dp, true);
            await updatePlayer(players, player, succ, message.author);
        }
        else {
            interactions.wSendAuthor(message.author, "Some stats are too high or not numbers.");
        }
    }
    else {
        interactions.wSendAuthor(message.author, "Incorrect format. Correct format is `<classname> [succession|awakening] <ap> <aap> <dp>`\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function succCommand(message) {
    let playerToFind = players.get(message.author.id);
    if (playerToFind && itemsjson["classlistSucc"].find(currentclassname => currentclassname == playerToFind.classname)) {
        await updatePlayer(players, playerToFind, true, message.author);
    }
    else {
        interactions.wSendAuthor(message.author, "Invalid command. Not registered to update to succession or not a succession class.");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function awakCommand(message) {
    let playerToFind = players.get(message.author.id);
    if (playerToFind) {
        await updatePlayer(players, playerToFind, false, message.author);
    }
    else {
        interactions.wSendAuthor(message.author, "Invalid command. Not registered to update to awakening.");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function axeCommand(split, message, args) {
    if (split.length == 1) {
        await updatePlayerAxe(message.author, args);
    }
    else {
        // too many arguments !
        interactions.wSendAuthor(message.author, "Invalid axe command.");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function allChannelsHandler(enteredCommand, commands, message) {
    commands = itemsjson["commands"]["any"]["guest"];
    enteredCommand = enteredCommand.substr(1);
    let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
    enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
    if (enteredCommand == commands["gear"] && checkIntPermission(message)) {
        gearCommand(message, args);
    }
    else if (enteredCommand == commands["stats"] && checkIntPermission(message)) {
        await statsCommand(args, message);
    }
    else if (enteredCommand == commands["rankings"] && checkIntPermission(message)) {
        await rankingsCommand(args, message);
    }
    else if (enteredCommand == commands["sub"]) {
        let rolename = args;
        //add roles here
        if (rolename == "rem" || rolename == "reminder") {
            // @ts-ignore
            await changeRole(message, rolename, args);
        }
    }
    else if (enteredCommand == commands["reminder"] && await checkAdvPermission(message)) {
        await reminderCommand(message);
    }
    else if (enteredCommand == commands["attendance"] && await checkIntPermission(message)) {
        await attendanceCommand(message);
    }
    else if (enteredCommand == commands["help"] && await checkIntPermission(message)) {
        await helpCommand(message, false);
    }
    else if (enteredCommand == commands["clear"] && await checkAdvPermission(message)) {
        await clearCommand(message);
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function changeRole(message, rolename, args) {
    let role = message.guild.roles.cache.find(x => x.name == rolename.charAt(0).toUpperCase() + rolename.slice(1));
    if (role) {
        if (message.member.roles.cache.has(role.id)) {
            await removeRole(message, role, args);
        }
        else {
            await addRole(message, role, args);
        }
    } else {
        logger.log("ERROR: No role " + rolename + " found");
    }
}

/**
 * 
 * @param {Discord.Message | Discord.PartialMessage} message 
 * @param {Discord.Role} role 
 * @param {string} args 
 */
async function addRole(message, role, args) {
    try {
        await message.member.roles.add(role);
        interactions.wSendAuthor(message.author, role.name + ' role added.');
        logger.log('ROLE: ' + role.name + ' role added to ' + message.author.tag);
        interactions.wDelete(message);
    }
    catch (e) {
        interactions.wSendAuthor(message.author, args + ' role not found or not self-assignable.');
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 * @param {Discord.Role} role
 */
async function removeRole(message, role, args) {
    try {
        await message.member.roles.remove(role);
        interactions.wSendAuthor(message.author, role.name + ' role removed.');
        logger.log('ROLE: ' + role.name + ' role removed from ' + message.author.tag);
        interactions.wDelete(message);
    }
    catch (e) {
        interactions.wSendAuthor(message.author, args + ' role not found or not self-assignable.');
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
function gearCommand(message, args) {
    startLoading(message);
    let idToFind;
    if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
        idToFind = message.mentions.members.first().id;
    }
    else {
        idToFind = args;
    }
    let playerFound = players.get(idToFind);
    if (playerFound) {
        interactions.wSendChannel(message.channel, players.displayFullPlayerGS(playerFound));
    }
    else {
        interactions.wSendChannel(message.channel, "Couldn't find this player.");
    }
    endLoading(message, 0);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function rankingsCommand(args, message) {
    if (!args) {
        startLoading(message);
        interactions.wSendChannel(message.channel, players.getRankingsEmbed(null));
        endLoading(message, 0);
    }
    else {
        let split = args.split(" ");
        if (itemsjson["classlist"].includes(split[0])) {
            startLoading(message);
            interactions.wSendChannel(message.channel, players.getRankingsEmbed(split[0]));
            endLoading(message, 0);
        }
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function statsCommand(args, message) {
    if (!args) {
        startLoading(message);
        interactions.wSendChannel(message.channel, players.getStatsEmbed(null));
        endLoading(message, 0);
    }
    else {
        let split = args.split(" ");
        if (split.length == 1) {
            if (itemsjson["classlist"].includes(split[0])) {
                startLoading(message);
                interactions.wSendChannel(message.channel, players.getStatsEmbed(split[0]));
                endLoading(message, 0);
            }
            else {
                let day;
                if (split[0]) {
                    if (split[0] == "today") {
                        let today = new Date();
                        day = today.getDay();
                    }
                    else if (util.findCorrespondingDayNumber(split[0]) != null) {
                        day = util.findCorrespondingDayNumber(split[0]);
                    }
                    if (day != undefined) {
                        startLoading(message);
                        let signedUpPlayers = await getPlayersWithStatus(day, players, "yes"); // TODO v2
                        if (signedUpPlayers) {
                            interactions.wSendChannel(message.channel, players.getSignedUpStatsEmbed(signedUpPlayers, day));
                        }
                        else {
                            interactions.wSendChannel(message.channel, "No message found for " + util.findCorrespondingDayName(day));
                        }
                        endLoading(message, 0);
                    }
                }
            }
        }
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function reminderCommand(message) {
    let today = new Date();
    let day = today.getDay();
    let naPlayers = await getPlayersWithStatus(day, players, "N/A");
    let reminderMessage = "";
    if (naPlayers.length > 0) {
        naPlayers.forEach(player => {
            reminderMessage += "<@" + player.id + ">\n";
        });
        reminderMessage += "Please vote for today 🔔";
    }
    else {
        reminderMessage += "Everyone voted for today 👍";
    }
    interactions.wSendChannel(message.channel, reminderMessage);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function attendanceCommand(message) {
    startLoading(message);
    await collectSignUps();
    interactions.wSendChannel(message.channel, getFormattedAttendanceForWeek());
    endLoading(message, 0);
}

/**
 * get the % of yes in the week
 * @return an array daynumber => percent of yes
 */
function getPercentAttendanceForWeek() {
    let attendance = [];
    for (let i = 0; i < 7; i++) {
        attendance[i] = getPercentAttendanceForADay(i);
    }
    return attendance;
}

/**
 * @param {number} day 
 * @return % of yes for day
 */
function getPercentAttendanceForADay(day) {
    let attend = 0;
    players.forEach(player => {
        if (player.signUps[day].status == "yes") {
            attend++;
        }
    });
    return Math.round(attend / players.length * 100);
}

/*
--------------------------------------- HISTORY section ---------------------------------------
*/

/**
 * @param {{reference : any}} annCache 
 */
async function cacheAnnouncements(annCache) {
    await myAnnouncement.messages.fetch({ limit: 100 }).then(messages => {
        messages.forEach(async message => {
            await message.reactions.cache.forEach(async reaction => {
                await reaction.users.fetch();
            });
        });
        annCache.reference = messages;
    });
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 * @returns an embed containing info about the message
 */
async function getHistoryEmbed(message) {
    let authorName = message.author.tag;
    let authorAvatar = message.author.avatarURL();
    let content = message.content;
    if (message.embeds.length > 0) {
        authorName = message.embeds[0].author.name;
        authorAvatar = message.embeds[0].author.iconURL;
        content = message.embeds[0].description;
    }
    const embed = new Discord.MessageEmbed();
    let embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setAuthor(authorName, authorAvatar);
    embed.setDescription(content);
    embed.setTimestamp(message.editedTimestamp ? message.editedTimestamp : message.createdTimestamp);
    message.attachments.forEach(attachment => {
        embed.files.push("./download/" + message.id + "/" + attachment.name);
    });
    message.reactions.cache.forEach(async reaction => {
        let users = "";
        reaction.users.cache.forEach(user => {
            users += user + "\n";
        });
        if (users) {
            embed.addField("Reacted with " + reaction.emoji, users, true);
        }
    });
    return embed;
}

/**
 * downloads files attached to the message and put it in download/messageid
 * @param {Discord.Message | Discord.PartialMessage} message
 */
async function downloadFilesFromMessage(message) {
    return new Promise(async (resolve, reject) => {
        if (message.attachments.size > 0) {
            await message.attachments.forEach(async element => {
                try {
                    if (!fs.existsSync("./download/" + message.id + "/")) {
                        fs.mkdirSync("./download/" + message.id + "/");
                    }
                    await files.download(element.url, "./download/" + message.id + "/" + element.name, () => { });
                    resolve();
                } catch (e) {
                    logger.logError("Could not download " + element.name + " file", e);
                    reject();
                }
            });
            setTimeout(() => {
                reject();
            }, 30000);
        } else {
            reject();
        }
    });
}

/**
 * 
 * @param {Discord.Collection<string,Discord.MessageReaction>} messageReactions
 */
// @ts-ignore
async function getReactions(messageReactions) {
    let res = "";
    // @ts-ignore
    messageReactions.forEach(reaction => {
        //unused
    });
    return res ? res : "No reactions";
}

/*
--------------------------------------- SIGNUP&GEAR section ---------------------------------------
*/

/**
 * 
 * @param {number} day 
 * @param {PlayerArray} players 
 * @param {string} status
 * @returns the players with that particular status if found, null if not
 */
async function getPlayersWithStatus(day, players, status) {
    let signUps = await getDaySignUp(day);
    if (signUps) {
        let correspondingPlayers = new PlayerArray();
        signUps.forEach(player => {
            if (player.status == status) {
                for (let i = 0; i < players.length; i++) {
                    if (player.id == players[i].id) {
                        correspondingPlayers.add(players[i]);
                        break;
                    }
                }
            }
        });
        return correspondingPlayers;
    } else {
        return null;
    }
}

/*
--------------------------------------- SIGNUP section ---------------------------------------
*/

/**
 * @param {number} num
 * generate num singup messages
 */
async function generateSignUpMessages(num) {
    for (let i = 0; i < num; i++) {
        let date = new Date();
        date.setDate(date.getDate() + i); // get the next day
        let content = util.findCorrespondingDayName(date.getDay()) + " - " + util.zeroString(date.getDate()) + "." + util.zeroString(date.getMonth() + 1) + "." + date.getFullYear();
        let message = await interactions.wSendChannel(mySignUp, content);
        await message.react(configjson["yesreaction"]);
        await message.react(configjson["noreaction"]);
    }
}

/**
 * @param {string} day
 * generate singup messages until day (inc today)
 */
// @ts-ignore
async function bulkSignUpMessages(day) {
    let today = new Date();
    let loops = day == "loop" ? 7 : util.diffDays(today.getDay(), util.findCorrespondingDayNumber(day));
    for (let i = 0; i <= loops; i++) {
        let date = new Date();
        date.setDate(date.getDate() + i); // get the next day
        let content = util.findCorrespondingDayName(date.getDay()) + " - " + util.zeroString(date.getDate()) + "." + util.zeroString(date.getMonth() + 1) + "." + date.getFullYear();
        let message = await interactions.wSendChannel(mySignUp, content);
        await message.react(configjson["yesreaction"]);
        await message.react(configjson["noreaction"]);
    }
}

/**
 * setup timeouts to save everyday at X hour; when one is done the next one is set
 */
function setupSignUpSchedule() {
    let today = new Date();
    let dd = (today.getDay() + Number(util.isNextDay(configjson["hourSignup"]))) % 7;
    let minUntilSave = util.getMinUntil(dd, configjson["hourSignup"], 0);
    bot.setTimeout(async () => {
        await dumpSignUps();
        setupSignUpSchedule();
    }, minUntilSave * 60 * 1000);
    logger.log("INFO: Sign ups save schedule set");
}

/**
 * gets a signup object from the message
 * @param {number} day 
 * @returns any[{ "name": [], "id": [], [dayStr]: [] }]
 */
async function getDaySignUp(day) {
    let signUps = [];
    let reactionMessage = await getDaySignUpMessage(day, mySignUp);
    if (reactionMessage) {
        let yesReaction = reactionMessage.reactions.filter(reaction => reaction.emoji.name == configjson["yesreaction"]).first();
        let noReaction = reactionMessage.reactions.filter(reaction => reaction.emoji.name == configjson["noreaction"]).first();
        if (noReaction) {
            let users = await noReaction.fetchUsers();
            await Promise.all(users.map(async user => {
                let member = await myServer.members.fetch(await bot.users.fetch(user.id));
                if (member.roles.cache.find(x => x.name == "Members")) {
                    addMemberToSignUps(member, signUps, "no");
                }
            }));
        }
        if (yesReaction) {
            let users = await yesReaction.fetchUsers();
            await Promise.all(users.map(async user => {
                let member = await myServer.members.fetch(await bot.users.fetch(user.id));
                if (member.roles.cache.find(x => x.name == "Members")) {
                    addMemberToSignUps(member, signUps, "yes");
                }
            }));
        }
        myServer.members.cache.forEach(member => {
            if (member.roles.cache.find(x => x.name == "Members")) {
                addMemberToSignUps(member, signUps, "N/A");
            }
        });
        return signUps;
    }
}

/**
 * 
 * @param {Discord.GuildMember} member 
 * @param {any[]} signUps 
 * @param {string} status 
 */
function addMemberToSignUps(member, signUps, status) {
    if (!signUpsHasId(signUps, member.id) && member.id != bot.user.id) {
        let player = players.find((player) => {
            return player.id == member.id;
        });
        if (player) {
            let playerInfo = player.getInfo();
            playerInfo.status = status;
            signUps.push(playerInfo);
        }
    }
}

/**
 * 
 * @param {any[]} signUps 
 * @param {string} id 
 * @returns whether the signups has this id
 */
function signUpsHasId(signUps, id) {
    for (let i = 0; i < signUps.length; i++) {
        let item = signUps[i];
        if (item["id"] == id) {
            return true;
        }
    }
    return false;
}

/**
 * @param {number} day 
 * @param {Discord.TextChannel} channel 
 * @returns the message containing the day, null if none
 */
async function getDaySignUpMessage(day, channel) {
    let message;
    let dateName = util.findCorrespondingDayName(day).toLowerCase();
    await channel.messages.fetch({ limit: 100 }).then(async messages => {
        message = await messages.find(message => message.content.toLowerCase().startsWith(dateName));
    });
    return message;
}

async function collectSignUps() {
    for (let day = 0; day < 7; day++) {
        let reactionMessage = await getDaySignUpMessage(day, mySignUp);
        if (reactionMessage) {
            let yesReaction = reactionMessage.reactions.cache.filter(reaction => reaction.emoji.name == configjson["yesreaction"]).first();
            let noReaction = reactionMessage.reactions.cache.filter(reaction => reaction.emoji.name == configjson["noreaction"]).first();
            if (noReaction) {
                await fetchSignUps(noReaction, day, "no");
            }
            if (yesReaction) {
                await fetchSignUps(yesReaction, day, "yes");
            }
            players.forEach(player => {
                if (!player.voted) {
                    player.setSignUpDay(day, "N/A");
                }
                player.voted = false;
            });
        }
    }
}

/**
 * 
 * @param {Discord.MessageReaction} reaction 
 * @param {number} day 
 * @param {string} emojiName 
 */
async function fetchSignUps(reaction, day, emojiName) {
    let users = await reaction.users.fetch();
    await Promise.all(users.map(async (user) => {
        if (!user.bot) {
            try {
                let member = await myServer.members.fetch(await bot.users.fetch(user.id));
                if (member && member.roles.cache.find(x => x.name == "Members")) {
                    let foundPlayer = players.get(member.id);
                    if (foundPlayer) {
                        foundPlayer.setSignUpDay(day, emojiName);
                        foundPlayer.voted = true;
                    }
                }
            }
            catch (e) {
                if (e.message == 'Unknown Member') {
                    logger.log("INFO: " + user + " is not a member !");
                    await reaction.users.remove(user);
                } else {
                    throw e;
                }
            }
        }
    }));
}

async function dumpSignUps() {
    let day = new Date();
    let signUps = getFormattedSignUps();
    let signuppath = "./download/signups" + day.getTime() + ".csv";
    const csv = parse(signUps);
    files.writeToFile(signuppath, csv);
    mySignUpData.send("!sheet update", {
        embed: await getSignUpsEmbed(),
        files: [
            signuppath
        ]
    });
}

function getFormattedSignUps() {
    let signUps = [];
    players.forEach(player => {
        if (player.isReal()) {
            let playerInfo = player.getInfo();
            addSignUpInfo(playerInfo, player);
            signUps.push(playerInfo);
        }
    });
    signUps.sort((a, b) => {
        var nameA = a.name.toLowerCase(), nameB = b.name.toLowerCase();
        if (nameA < nameB) //sort string ascending
            return -1;
        if (nameA > nameB)
            return 1;
        return 0; //default return value (no sorting)
    });
    return signUps;
}

function addSignUpInfo(playerInfo, player) {
    let date = new Date();
    playerInfo.status = player.signUps[date.getDay()].status;
    for (let i = 0; i < 7; i++) {
        playerInfo[util.findCorrespondingDayName(i)] = player.signUps[i].status;
    }
    for (let i = 0; i < 7; i++) {
        playerInfo[util.findCorrespondingDayName(i) + " Timestamp"] = player.signUps[i].date ? player.signUps[i].date.toLocaleDateString() + " " + player.signUps[i].date.toLocaleTimeString() : "";
    }
}

async function getSignUpsEmbed() {
    let day = new Date();
    const embed = new Discord.MessageEmbed();
    let embedTitle = ":bookmark_tabs: SIGN UPS";
    let embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);
    let yesToSend = "";
    let yes = 0;
    players.forEach(element => {
        if (element.signUps[day.getDay()].status == "yes") {
            yesToSend += "<@" + element.id + ">" + "\n";
            yes++;
        }
    });

    let noToSend = "";
    let no = 0;
    players.forEach(element => {
        if (element.signUps[day.getDay()].status == "no") {
            noToSend += "<@" + element.id + ">" + "\n";
            no++;
        }
    });

    let naToSend = "";
    let na = 0;
    players.forEach(element => {
        if (element.isReal() && element.signUps[day.getDay()].status == "N/A") {
            naToSend += "<@" + element.id + ">" + "\n";
            na++;
        }
    });
    embed.addField("Attendance per week *(by votes)*", getFormattedAttendanceForWeek(), false);
    if (yesToSend) {
        embed.addField(configjson["yesreaction"] + " YES for today (" + yes + ")", yesToSend, true);
    }
    if (noToSend) {
        embed.addField(configjson["noreaction"] + " NO for today (" + no + ")", noToSend, true);
    }
    if (naToSend) {
        embed.addField(":question:" + " N/A for today (" + na + ")", naToSend, true);
    }
    embed.setTimestamp()
    return embed;
}

function getFormattedAttendanceForWeek() {
    let attendance = getPercentAttendanceForWeek();
    let attendanceTable = "```ts\n+-----+-----+-----+-----+-----+-----+-----+\n";
    for (let i = 0; i < 7; i++) {
        attendanceTable += "| " + util.findCorrespondingDayNameShort(i) + " ";
    }
    attendanceTable += "|";

    attendanceTable += "\n+-----+-----+-----+-----+-----+-----+-----+\n";

    for (let i = 0; i < 7; i++) {
        let value;
        if (attendance[i] == 100) {
            value = attendance[i];
        } else {
            value = util.valueFormat(attendance[i] + "", 10) + "%";
        }
        attendanceTable += "| " + value + " ";
    }
    attendanceTable += "|";

    attendanceTable += "\n+-----+-----+-----+-----+-----+-----+-----+\n```";
    return attendanceTable;
}

/*
--------------------------------------- GEAR section ---------------------------------------
*/

/**
 * remove a player from a player list
 * @param {PlayerArray} players 
 * @param {string} playerId 
 * @param {Discord.User | Discord.PartialUser} origin
 */
async function removePlayer(players, playerId, origin) {
    let removed = players.remove(playerId);
    if (removed) {
        let content = "";
        content += players.displayFullPlayer(removed[0]) + "\nRemoved from gear list.";
        content += "\n(Command origin: " + origin + ")";
        await interactions.wSendChannel(myChangelog, content);
        await interactions.wSendChannel(myChangelog2, content);
    }
}

/**
 * remove and add (readd) a player to a player list
 * @param {PlayerArray} players 
 * @param {Player} player 
 * @param {boolean} succ succ was true or not (null if no succ info given)
 * @param {Discord.User | Discord.PartialUser} origin
 */
async function updatePlayer(players, player, succ, origin) {
    let content = "";
    let foundPlayer = players.get(player.id);
    let oldPlayer = { ...foundPlayer };
    players.findAndUpdate(player, succ);
    if (foundPlayer) {
        content += "> Updated " + foundPlayer.getNameOrMention() + "'s gear :\n";
        content += changeLogFormatter("Class : ", oldPlayer.classname, foundPlayer.classname, players.getClassEmoji(oldPlayer), players.getClassEmoji(foundPlayer));
        let statsContent = "";
        statsContent += changeLogFormatter("AP  : ", oldPlayer.ap, foundPlayer.ap);
        statsContent += changeLogFormatter("AAP : ", oldPlayer.aap, foundPlayer.aap);
        statsContent += changeLogFormatter("DP  : ", oldPlayer.dp, foundPlayer.dp);
        if (statsContent != "") {
            content += "```ml\n" + statsContent + "```";
        }
    } else {
        content += "> New player\n";
        content += players.displayFullPlayer(player) + "\n";
    }
    content += "(Command origin: " + origin + ")";
    await interactions.wSendChannel(myChangelog, content);
    await interactions.wSendChannel(myChangelog2, content);
}

/**
 * @param {string} prefix 
 * @param {any} value1 
 * @param {any} dspvalue1 how value1 is displayed
 * @param {any} value2 
 * @param {any} dspvalue2 how value2 is displayed
 * @returns examples : 250 -> 255 (+5), 200 -> 200, name -> name
 */
function changeLogFormatter(prefix, value1, value2, dspvalue1 = value1, dspvalue2 = value2) {
    if (value1 != value2) {
        let display = prefix + dspvalue1 + " -> " + dspvalue2;
        let diff = "";
        if (parseInt(value1) && parseInt(value2)) {
            let diffNumber = (parseInt(value2) - parseInt(value1));
            diff = diffNumber != 0 ? (" (" + (diffNumber > 0 ? ("+" + diffNumber) : diffNumber) + ")") : "";
        }
        display += diff;
        display += "\n";
        return display;
    }
    return "";
}

/**
 * updates a player's axe level and logs it in changelog
 * @param {Discord.User} author 
 * @param {string} args 
 */
async function updatePlayerAxe(author, args) {
    let playerToFind = players.get(author.id);
    if (playerToFind) {
        let oldAxe = playerToFind.getAxe(true);
        playerToFind.setAxe(args);
        await interactions.wSendChannel(myChangelog, "> Updated " + playerToFind.getNameOrMention() + "'s axe :\n" + oldAxe + " -> " + playerToFind.getAxe(true));
        await interactions.wSendChannel(myChangelog2, "> Updated " + playerToFind.getNameOrMention() + "'s axe :\n" + oldAxe + " -> " + playerToFind.getAxe(true));
    } else {
        await interactions.wSendAuthor(author, "You need to be registered to do that.");
    }
}

async function savePlayers() {
    let playerspath = "./download/players.json";
    await files.writeObjectToFile(playerspath, players);
    await files.uploadFileToChannel(playerspath, myGearData, configjson["gearDataMessage"]);
}

/**
 * if the bot message exists, edits it
 * if not, sends a new one
 * @param {Discord.Channel} channel the channel where the original message comes from
 * @param {Object} botMsg the bot message
 * @param {PlayerArray} players
 * @returns the new message
 */
async function refreshBotMsg(channel, botMsg, players) {
    if (!botMsg.reference) {
        //no bot message to begin with, create a new one
        botMsg.reference = await newBotMessage(channel, players.getEmbed());
    } else {
        if (!await interactions.wEditMsg(botMsg.reference, players.getEmbed())) {
            //message probably got deleted or something, either way creating a new one
            logger.log("INFO: Couldn't find the existing bot message to edit, creating a new one");
            botMsg.reference = await newBotMessage(channel, players.getEmbed());
        }
    }
}

async function newBotMessage(channel, content) {
    let sentMessage;
    sentMessage = await interactions.wSendChannel(channel, content);
    return sentMessage;
}

/**
 * @param {Discord.TextChannel} channelSource
 * @param {Discord.TextChannel} channelDestination
 */
async function historizeChannel(channelSource, channelDestination) {
    let messages = await channelSource.messages.fetch();
    messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    let pdfPath = await createHistoryPDF(messages);
    files.uploadFileToChannel(pdfPath, channelDestination, "History of " + channelSource.name);
    clearChannel(channelSource);
}

/**
 * @param {Discord.Collection <String, Discord.Message>} messages
 */
async function createHistoryPDF(messages) {
    return new Promise(async (resolve, reject) => {
        try {
            let fonts = getFonts();

            let PdfPrinter = require('pdfmake');
            let printer = new PdfPrinter(fonts);
            let fs = require('fs');

            let content = [];
            for (const imessage of messages) {
                let message = imessage[1];
                let strDate = getFormattedDate(message.createdAt);
                content.push(message.author.username + " (" + strDate + ") : " + message);
                if (message.attachments.size > 0) {
                    await addMessageAttachmentToPDFContent(message, content);
                }
            }
            let docDefinition = {
                content: content,
                defaultStyle: {
                    font: 'Courier'
                }
            };

            let pdfName = 'download/document' + new Date().getTime() + '.pdf';
            let pdfDoc = printer.createPdfKitDocument(docDefinition);
            let stream = pdfDoc.pipe(fs.createWriteStream(pdfName));
            pdfDoc.end();
            stream.on('finish', function () {
                resolve(pdfName);
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 * @param {any[]} content 
 */
async function addMessageAttachmentToPDFContent(message, content) {
    await downloadFilesFromMessage(message);
    for (const iattachment of message.attachments) {
        let attachment = iattachment[1];
        if (attachment.name.toUpperCase().endsWith('PNG') ||
            attachment.name.toUpperCase().endsWith('JPEG') ||
            attachment.name.toUpperCase().endsWith('JPG')) {
            let filePath = 'download/' + message.id + '/' + attachment.name;
            const imageToBase64 = require('image-to-base64');
            let image64 = await imageToBase64(filePath);
            content.push({
                image: 'data:image/png;base64,' + image64,
                fit: [300, 167]
            });
        }
    }
}

function getFormattedDate(date) {
    return 'd/m/Y at h:mm'
        // @ts-ignore
        .replace('Y', date.getFullYear())
        // @ts-ignore
        .replace('m', date.getMonth() + 1)
        // @ts-ignore
        .replace('d', util.zeroString(date.getDate()))
        // @ts-ignore
        .replace('h', util.zeroString(date.getHours()))
        // @ts-ignore
        .replace('mm', util.zeroString(date.getMinutes()));
}

function getFonts() {
    return {
        Courier: {
            normal: 'Courier',
            bold: 'Courier-Bold',
            italics: 'Courier-Oblique',
            bolditalics: 'Courier-BoldOblique'
        }
    };
}

/**
 * deletes all messages in the channel
 * @param {Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel} channel the channel to clean
 */
async function clearChannel(channel) {
    let messages = await channel.messages.fetch({ limit: 100 });
    for (const imessage of messages) {
        let message = imessage[1];
        message.delete();
    }
}

/*
--------------------------------------- GENERAL section ---------------------------------------
*/

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
function startLoading(message) {
    message.react("🔄");
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function endLoading(message, retry) {
    let reaction = message.reactions.cache.find(r => r.emoji.name == "🔄");
    if (reaction != null) {
        await reaction.users.remove(bot.user);
        message.react("✅");
    } else {
        if (retry < 5) {
            setTimeout(() => {
                endLoading(message, retry++);
            }, 1000);
        }
    }
}

/**
 * custom DMs
 */
function setupCustomAlarms() {
    let azreeId = "217391541918892032";
    let minUtilAlarm = util.getMinUntil(new Date().getDay(), 19, 45) * 60 * 1000;
    dailyTimeout(azreeId, minUtilAlarm);
    logger.log("INFO: Custom alarms set");
}

/**
 * @param {string} id 
 * @param {number} time 
 */
function dailyTimeout(id, time) {
    bot.setTimeout(async () => {
        if (time > 0 && players.get(id) && players.get(id).signUps[new Date().getDay()].status == "yes") {
            interactions.wSendChannel(myServer.members.cache.find(x => x.id == id), "Oublie pas les addons PvP");
        }
        dailyTimeout(id, 86400000);
    }, time);
}

function setupAlarms() {
    let channel = myGuildChat;
    for (const key in alarmsjson) {
        let dayName = key;
        for (const hour in alarmsjson[dayName]) {
            let minUntilAlarm = mod(util.getMinUntil(util.findCorrespondingDayNumber(dayName.toLowerCase()), hour, 0), 10080);
            let msUntilAlarm = minUntilAlarm * 60 * 1000;
            let alarmText = myServer.roles.cache.find(x => x.name === "Rem") + "\n";
            alarmsjson[dayName][hour].forEach(alarm => {
                alarmText += "Hey don't forget to grab your " + alarm + " 💰\n";
            });
            bot.setTimeout(async () => {
                interactions.wSendChannel(channel, alarmText);
            }, msUntilAlarm);
        }
    }
    logger.log("INFO: Alarms set");
}

/**
 * The fundamental problem is in JS % is not the modulo operator. It's the remainder operator. There is no modulo operator in JavaScript.
 * @param {number} n 
 * @param {number} m 
 */
function mod(n, m) {
    return ((n % m) + m) % m;
}

async function setupPresence() {
    bot.setInterval(async () => {
        await myAnnouncement.messages.fetch({ limit: 1 }).then(messages => {
            let message = messages.first();
            let issuedTimestamp = message.editedTimestamp ? message.editedTimestamp : message.createdTimestamp;
            let startDate = new Date();
            let seconds = (issuedTimestamp - startDate.getTime()) / 1000;
            let presence = Math.abs(seconds) > 86400 ? "Remedy" : "Announcement " + util.displayHoursMinBefore(Math.abs(Math.round(seconds / 60))) + " ago";
            try {
                bot.user.setPresence({
                    activity:
                    {
                        name: presence,
                        type: "PLAYING"
                    }
                });
            } catch (e) {
                logger.logError("Game status error", e);
            }
        });
    }, 60000);
}

/**
 * delete a command message
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function deleteCommand(message) {
    if ((!message.content.startsWith("! ") || (message.content.startsWith("! ") && !await checkAdvPermission(message))) && message.author.id != bot.user.id) {
        bot.setTimeout(async () => {
            await interactions.wDelete(message);
        }, configjson["deleteDelay"]);
    }
}

/**
 * whether the user has int user permissions
 * @param {Discord.Message | Discord.PartialMessage} message the original message
 * @returns true if user is allowed, false if not
 */
function checkIntPermission(message) {
    let allowed = false;
    if (message.member.roles.cache.find(x => x.name == "Members")) {
        allowed = true;
    }
    return allowed;
}

/**
 * whether the user has adv user permissions
 * @param {Discord.Message | Discord.PartialMessage} message the original message
 * @returns true if user is allowed, false if not
 */
async function checkAdvPermission(message) {
    let allowed = false;
    if (message.member.roles.cache.find(x => x.name == "Officers") || message.member.roles.cache.find(x => x.name == "Officer")) {
        allowed = true;
    } else {
        await interactions.wSendAuthor(message.author, 'Insufficient permissions.');
    }
    return allowed;
}

/**
 * @param {string} id the player's id
 * @param {string} classname
 * @param {string} ap
 * @param {string} aap
 * @param {string} dp
 * @param {number} axe
 * @returns a player object with the given data
 */
async function revivePlayer(id, classname, ap, aap, dp, axe = 0, signUps, real) {
    try {
        let playerId = real ? await myServer.members.fetch(await bot.users.fetch(id)) : id;
        let newPlayer = new Player(playerId, classname, ap, aap, dp, real);
        newPlayer.setAxe(axe);
        if (signUps) {
            newPlayer.setSignUps(signUps);
        }
        return newPlayer;
    } catch (e) {
        logger.logError("No member found for " + id + " !", e);
        return null;
    }
}

/**
 * downloads a file attached to the last message of the channel and put it in download/
 * @param {string} filename the file's name
 * @param {Discord.TextChannel} channel the channel to download from
 */
async function downloadGearFileFromChannel(filename, channel) {
    return new Promise(async (resolve, reject) => {
        let messages = await channel.messages.fetch({ limit: 1 });
        messages.forEach(async message => {
            if (message.content == configjson["gearDataMessage"] && message.attachments) {
                for (const iattachment of message.attachments) {
                    let element = iattachment[1];
                    if (element.name == filename) {
                        try {
                            await files.download(element.url, "./download/" + filename, () => { });
                            logger.log("HTTP: " + filename + " downloaded !");
                            resolve();
                        } catch (e) {
                            logger.logError("Could not download the file " + filename, e);
                            reject();
                        }
                    }
                }

            }
        });
        setTimeout(() => {
            reject();
        }, 30000);
    });
}

/**
 * fetch an emoji from the server
 * @param {string} name 
 */
function fetchEmoji(name) {
    return myDevServer.emojis.cache.find(emoji => emoji.name == name);
}

// ------ bot general behavior ------

//globals
const bot = new Discord.Client();
var configjsonfile = files.openJsonFile("./resources/config.json", "utf8");
var configjson = process.env.TOKEN ? configjsonfile["prod"] : configjsonfile["dev"];
var itemsjson = files.openJsonFile("./resources/items.json", "utf8");
var alarmsjson = files.openJsonFile("./resources/alarms.json", "utf8");
var init = false;

if (configjson && itemsjson && alarmsjson) {
    // Initialize Discord Bot
    var token = process.env.TOKEN ? process.env.TOKEN : configjson["token"];
    bot.login(token);

    //more globals
    /**
     * @type Discord.Guild
     */
    var myServer;
    /**
     * @type Discord.Guild
     */
    var myTrialServer;
    /**
     * @type Discord.Guild
     */
    var myDevServer;
    /**
     * @type Discord.TextChannel
     */
    var myGate;
    /**
     * @type Discord.TextChannel
     */
    var myGear;
    /**
     * @type Discord.TextChannel
     */
    var myGearData;
    /**
     * @type Discord.TextChannel
     */
    var mySignUp;
    /**
     * @type Discord.TextChannel
     */
    var mySignUpData;
    /**
     * @type Discord.TextChannel
     */
    var myTrial;
    /**
     * @type Discord.TextChannel
     */
    var myTrialHistory;
    /**
     * @type Discord.TextChannel
     */
    var myAnnouncement;
    /**
     * @type Discord.TextChannel
     */
    var myAnnouncementData;
    /**
     * @type Discord.TextChannel
     */
    var myWelcome;
    /**
     * @type Discord.TextChannel
     */
    var myTrialWelcome;
    /**
     * @type Discord.TextChannel
     */
    var myChangelog;
    /**
     * @type Discord.TextChannel
     */
    var myChangelog2;
    /**
     * @type Discord.TextChannel
     */
    var myGuildChat;
    var players = new PlayerArray(itemsjson["classlist"]);
    var classEmojis = [];
    var loading = 1000;

    bot.once("ready", async () => {
        logger.log("INFO: Logged in as " + bot.user.tag);
        bot.user.setPresence({ activity: { name: "booting up..." } });

        logger.log("INFO: Starting in " + loading + "ms");
        var interval = setInterval(async () => {
            myServer = bot.guilds.cache.get(configjson["botServerID"]);
            myTrialServer = bot.guilds.cache.get(configjson["botTrialServerID"]);
            myDevServer = bot.guilds.cache.get(configjsonfile["dev"]["botServerID"]);
            // @ts-ignore
            myGate = bot.channels.cache.get(configjson["gateID"]);// @ts-ignore
            myGear = bot.channels.cache.get(configjson["gearID"]);// @ts-ignore
            myGearData = bot.channels.cache.get(configjson["gearDataID"]);// @ts-ignore
            mySignUp = bot.channels.cache.get(configjson["signUpID"]);// @ts-ignore
            mySignUpData = bot.channels.cache.get(configjson["signUpDataID"]);// @ts-ignore
            myTrial = bot.channels.cache.get(configjson["trialreactionID"]);// @ts-ignore
            myTrialHistory = bot.channels.cache.get(configjson["trialhistoryID"]);// @ts-ignore
            myAnnouncement = bot.channels.cache.get(configjson["announcementID"]);// @ts-ignore
            myAnnouncementData = bot.channels.cache.get(configjson["announcementDataID"]);// @ts-ignore
            myWelcome = bot.channels.cache.get(configjson["welcomeID"]);// @ts-ignore
            myTrialWelcome = bot.channels.cache.get(configjson["trialwelcomeID"]);// @ts-ignore
            myChangelog = bot.channels.cache.get(configjson["changelogID"]);// @ts-ignore
            myChangelog2 = bot.channels.cache.get(configjson["changelogID2"]);// @ts-ignore
            myGuildChat = bot.channels.cache.get(configjson["guildchatID"]);

            logger.log("INFO: Booting up attempt...");
            if (myServer && myDevServer && myGate && myGear && myGearData && classEmojis && mySignUp
                && mySignUpData && myAnnouncement && myAnnouncementData && myWelcome && myChangelog && myGuildChat) {

                initEmojis();

                //attempt to load a previously saved state
                await initPlayers();

                clearInterval(interval);
                logger.log("INFO: ... success !");

                if (!init) {
                    initLookout();
                    init = true;
                } else {
                    logger.log("INFO: Lookout already started");
                }
            } else {
                logger.log("...failed, retrying in " + loading + "ms");
                loading = loading * 2;
            }
        }, loading);

    });
} else {
    logger.log("INFO: Couldn't find config.json and items.json files, aborting.");
}
async function initPlayers() {
    try {
        await downloadGearFileFromChannel("players.json", myGearData);
    } catch (e) {
        logger.log("INFO: Couldn't find or download the players file");
    }
    var playersjson = files.openJsonFile("./download/players.json", "utf8");
    if (playersjson) {
        for (const currentPlayer of playersjson) {
            let revivedPlayer = await revivePlayer(
                currentPlayer["id"],
                currentPlayer["classname"],
                currentPlayer["ap"],
                currentPlayer["aap"],
                currentPlayer["dp"],
                currentPlayer["axe"],
                currentPlayer["signUps"],
                currentPlayer["real"]
            );
            if (revivedPlayer) {
                players.add(revivedPlayer);
            }
        }
    }
}

function initEmojis() {
    itemsjson["classlist"].forEach(async (classname) => {
        classEmojis.push(fetchEmoji(classname));
    });
    itemsjson["classlistSucc"].forEach(async (classname) => {
        classEmojis.push(fetchEmoji(classname + "Succ"));
    });
    players.setClassEmojis(classEmojis);
}

