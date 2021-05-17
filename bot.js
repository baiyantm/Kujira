// @ts-check
const Shell = require('shelljs');
const Discord = require('discord.js');
const fs = require('fs');
const { parse } = require('json2csv');
const files = require("./modules/files");
const interactions = require("./modules/interactions");
const logger = require("./modules/logger");
const util = require("./modules/util");
const Player = require('./classes/Player');
const PlayerArray = require('./classes/PlayerArray');
const Server = require('./classes/Server');

ghostScriptGet();

async function initLookout() {
    bot.user.setPresence({ activity: { name: 'commands', type: 'LISTENING' } });

    /*if (myGuildChat) {
        setupAlarms();
    }

    if (myServer) {
        setupCustomAlarms();
    }*/

    var annCache = { reference: null }; //because JavaScript
    await cacheAnnouncements(annCache);
    await cacheSignUps();
    await cacheTrialMessage();
    annCache.reference.forEach(async message => {
        try {
            await downloadFilesFromMessage(message);
        } catch (e) {
            //nothing to dl
        }
    });

    for (let i = 0; i < myServers.length; i++) {
        let server = myServers[i];
        server.botMsg = { reference: null }; //because JavaScript
        //lookup for a previous message so we keep using it
        let messages = await fetchAllMessages(server.myGear);
        var found = 0;
        messages.forEach(message => {
            if (message.author.id == bot.user.id) {
                if (!found) {
                    server.botMsg.reference = message;
                    found++;
                } else if (found == 1) {
                    server.botMsg.reference = null;
                    logger.log("INFO: Found multiple existing messages, aborting and generating a new one instead.");
                    found++;
                }
            }
        });
        await refreshBotMsg(server.myGear, server.botMsg, players);
    }

    bot.on("guildMemberRemove", member => onLeaveHandler(member));

    bot.on("message", async message => onMessageHandler(message, annCache));

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
                channel.messages.fetch(packet.d.message_id).then(async message => {
                    // Emojis can have identifiers of name:id format, so we have to account for that case as well
                    const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
                    // This gives us the reaction we need to emit the event properly, in top of the message object
                    const reaction = message.reactions.cache.get(emoji);
                    // Adds the currently reacting user to the reaction's users collection.
                    if (reaction) reaction.users.cache.set(packet.d.user_id, bot.users.cache.get(packet.d.user_id));
                    // Check which type of event it is before emitting
                    bot.emit('messageReactionAdd', reaction, (await bot.users.fetch(packet.d.user_id)));
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
                // @ts-ignore
                bot.emit('messageDelete', { channel: { id: packet.d.channel_id }, id: packet.d.id });
            }
        }
    });

    bot.setInterval(async () => {
        savePlayers();
    }, configjson["saveDelay"]);

    setupSignUpSchedule();

    collectAllSignUps();
    bot.setInterval(() => {
        collectAllSignUps();
    }, configjson["signupDelay"]);

    process.on('SIGTERM', async function () {
        logger.log("Recieved signal to terminate, saving and shutting down");
        await savePlayers();
        bot.destroy();
        process.exit(0);
    });

    logger.log("INFO: Initialization done");
}

/**
 * listener for member leaving guild
 * @param {Discord.GuildMember | Discord.PartialGuildMember} member 
 */
async function onLeaveHandler(member) {
    let server = getServerById(member.guild.id);
    if (server && member.guild.id == server.self.id) {
        interactions.wSendChannel(server.myWelcome, member.toString() + "(" + member.user.username + ") has left the server.");
    } else if (member.guild.id == myTrialServer.id) {
        interactions.wSendChannel(myTrialWelcome, member.toString() + "(" + member.user.username + ") has left the server.");
    }
}

/**
 * listener for message edit
 * @param {Discord.Message | Discord.PartialMessage} newMessage 
 * @param {{reference : any}} annCache 
 */
async function onEditHandler(newMessage, annCache) {
    if (newMessage.channel.id == getMyServer().myAnnouncement.id) {
        cacheAnnouncements(annCache);
    }
}

/**
 * listener for message delete
 * @param {Discord.Message | Discord.PartialMessage} deletedMessage 
 * @param {{reference : any}} annCache 
 */
async function onDeleteHandler(deletedMessage, annCache) {
    try {
        if (deletedMessage.channel.id == getMyServer().myAnnouncement.id) {
            interactions.wSendChannel(getMyServer().myAnnouncementData, await getHistoryEmbed(deletedMessage));
            cacheAnnouncements(annCache);
        }
    } catch (e) {
        console.error(e);
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
        trialReactionRemoveHandler(messageReaction, user);
    }
}

/**
 * listener for emoji add event
 * @param {Discord.MessageReaction} messageReaction 
 * @param {Discord.User | Discord.PartialUser} user 
 */
async function onReactionAddHandler(messageReaction, user) {
    let server = getServerById(messageReaction.message.guild.id);
    if (server && messageReaction.message.channel.id == server.mySignUp.id) {
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
        const guildMember = await guild.members.fetch(user.id);
        if (!advPermission(guildMember)) {
            interactions.wSendChannel(myTrialWelcome, guildMember.toString() + " clicked on ⚔️");
            const roleIndex = await getNextTrialRoleIndex(guild);
            const role = guild.roles.cache.find(x => x.name == "Trial " + roleIndex);
            const channel = guild.channels.cache.find(x => x.name == "trial-" + roleIndex);
            try {
                if (channel) {
                    // @ts-ignore
                    await historizeChannel(channel, myTrialHistory);
                }
                await guildMember.roles.add(role);
                await guildMember.roles.add(guild.roles.cache.find(x => x.name == "Trialee"));
                // @ts-ignore
                await interactions.wSendChannel(channel, user.toString() + " Hi, please post your gear screenshot here in this format: https://imgur.com/a/eYiNNgd")
            } catch (e) {
                interactions.wSendChannel(myTrialWelcome, "Error while trying to add a trialee : " + e.toString());
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
            available = await isTrialRoleAvailable(guild, trialRole);
            if (!available) {
                roleCount++;
            } else {
                let trialChannel = guild.channels.cache.find(channel => channel.name.startsWith("trial-" + roleCount));
                if (!trialChannel) {
                    await createNewTrialChannelAndRole(guild, roleCount, trialRole, roleName);
                }
            }
        } else {
            await createNewTrialChannelAndRole(guild, roleCount, trialRole, roleName);
            available = true;
        }
    }
    return roleCount;
}

/**
 * 
 * @param {Discord.Guild} guild 
 * @param {number} roleCount 
 * @param {Discord.Role} trialRole 
 * @param {string} roleName 
 */
async function createNewTrialChannelAndRole(guild, roleCount, trialRole, roleName) {
    let channels = guild.channels.cache.array();
    let trialMax = getTrialMaxNumber(channels);
    let lastTrialChannel = guild.channels.cache.find(channel => channel.name.startsWith("trial-" + trialMax));
    let newTrialChannel = await lastTrialChannel.clone({
        name: "trial-" + roleCount,
        permissionOverwrites: lastTrialChannel.permissionOverwrites
    });
    await newTrialChannel.edit({
        position: lastTrialChannel.position + 1
    });
    let lastTrialRole = guild.roles.cache.find(x => x.name == "Trial " + trialMax);
    if (!trialRole) {
        trialRole = await guild.roles.create({
            data: {
                name: roleName,
                position: lastTrialRole.position - 1,
                permissions: lastTrialRole.permissions
            }
        });
    }
    await newTrialChannel.updateOverwrite(trialRole, {
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

function getTrialMaxNumber(channels) {
    let trialMax = 1;
    for (let i = 0; i < channels.length; i++) {
        let channel = channels[i];
        if (channel.name.startsWith("trial-")) {
            let trialNumber = parseInt(channel.name.split("-")[1]);
            trialMax = trialMax > trialNumber ? trialMax : trialNumber;
        }
    }
    return trialMax;
}

/**
 * gets the next trial role, if not available, creates it
 * @param {Discord.Guild} guild 
 */
async function isTrialRoleAvailable(guild, role) {
    let available = true;
    let members = await guild.members.fetch();
    for (const imember of members) {
        let member = imember[1];
        if (member.roles.cache.has(role.id)) {
            available = false;
        }
    }
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
        if (!advPermission(guildMember)) {
            interactions.wSendChannel(myTrialWelcome, guildMember.toString() + " unclicked on ⚔️");
            guildMember.roles.cache.forEach(role => {
                if (role.name.startsWith("Trial")) {
                    try {
                        guildMember.roles.remove(role);
                    } catch (e) {
                        console.error(e);
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
    let today = new Date();
    let dateName = util.findCorrespondingDayName(today.getDay()).toLowerCase();
    let lockedSignUps = today.getHours() >= 19 && today.getHours() <= 20 && message.content.toLowerCase().startsWith(dateName);
    let yesReaction = message.reactions.cache.filter(reaction => reaction.emoji.name == configjson["yesreaction"]).first();
    let noReaction = message.reactions.cache.filter(reaction => reaction.emoji.name == configjson["noreaction"]).first();
    if (user.id != bot.user.id) {
        if (messageReaction.emoji.name == configjson["noreaction"] && (await yesReaction.fetch()).users.cache.get(user.id)) {
            removeUserFromReaction(yesReaction, user);
        } else if (messageReaction.emoji.name == configjson["yesreaction"]) {
            if (lockedSignUps) {
                removeUserFromReaction(yesReaction, user);
                // @ts-ignore
                interactions.wSendAuthor(user, configjson["yesreaction"] + " locked after 19:00, please contact an Officer");
            } else if ((await noReaction.fetch()).users.cache.get(user.id)) {
                removeUserFromReaction(noReaction, user);
            }
        }
    }
}

/**
 * removes the user from the message reaction
 * @param {Discord.MessageReaction} messageReaction 
 * @param {Discord.User | Discord.PartialUser} user 
 */
function removeUserFromReaction(messageReaction, user) {
    messageReaction.users.remove(user.id);
}

/**
 * listener for message event
 * @param {Discord.Message | Discord.PartialMessage} message the message sent
 * @param {{reference : any}} annCache 
 */
async function onMessageHandler(message, annCache) {
    //if (message.author.bot) return; //bot ignores bots
    var commands;
    let enteredCommand = message.content.toLowerCase();
    let server = getServerById(message.guild.id);
    try {
        if(server) {
            if (message.channel.id == server.myAnnouncement.id) {
                await cacheAnnouncements(annCache);
                if (message.attachments.size > 0) {
                    downloadFilesFromMessage(message);
                }
            } else if (message.channel.id == server.myGate.id) {
                // === GATE ===
                gateChannelHandler(commands, enteredCommand, message);
            } else if (message.channel.id == server.mySignUp.id) {
                // === SIGNUP ===
                signupChannelHandler(enteredCommand, message, commands);
            } else if (message.channel.id == server.myGear.id) {
                // === GEAR ===
                gearChannelHandler(enteredCommand, message, commands);
            } else if (message.channel.id == server.mySignUpData.id) {
                // === SIGNUP DATA ===
                signupDataChannelHandler(enteredCommand, message, commands);
            }
        } else {
            // === ALL CHANNELS ===
            if (enteredCommand.startsWith("?")) {
                allChannelsHandler(enteredCommand, commands, message);
            }
        }
    } catch (e) {
        console.error(e);
        logger.logError("On message listener error", e);
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
            dumpCommand(message, args);
        }
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function gateChannelHandler(commands, enteredCommand, message) {
    if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
        commands = itemsjson["commands"]["gate"]["adv"];
        enteredCommand = enteredCommand.substr(1);
        if (enteredCommand == commands["gate"]) {
            gateCommand();
        }
    } else {
        commands = itemsjson["commands"]["gate"]["guest"];
        if (enteredCommand == commands["ok"]) {
            okCommand(message);
        }
    }
    deleteCommand(message);
}

/**
 * sends the gate message
 */
async function gateCommand() {
    let gateEmbed = new Discord.MessageEmbed();
    gateEmbed.title = "You're about to enter the Remedy guild's discord";
    gateEmbed.color = 3447003;
    gateEmbed.description = `*Please be aware of the following rules before proceeding*
    
    - Be respectful to everyone regardless of gender, race, orientation or religion.
    - Excessive usage of inappropriate language is not tolerated.
    - No doxing or linking to any personal information outside from the origin of it.
    - No witch-hunting/name-shaming.
    
    Failure to respect those rules can lead to warnings or bans.
    
    If you understand type \`ok\` here`;
    interactions.wSendChannel(getMyServer().myGate, gateEmbed);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function okCommand(message) {
    let publicRole = message.guild.roles.cache.find(x => x.name == "Public");
    if (!message.member.roles.cache.has(publicRole.id)) {
        await message.member.roles.add(publicRole);
        logger.log("ROLE: " + publicRole + " role added to " + message.author.tag.toString());
        await interactions.wSendAuthor(message.author, itemsjson["urlguildpage"]);
        await interactions.wSendAuthor(message.author, itemsjson["gateguide"] + "\n\nReminder that you agreed to the following rules :\n" + itemsjson["gaterules"]);
        await interactions.wSendChannel(getMyServer().myWelcome, message.author.toString() + " agreed to the rules and got the public role.");
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
            clearCommand(message);
        }
        else if (enteredCommand == commands["reset"]) {
            resetCommand(message, args);
        }
        else if (enteredCommand == commands["dump"]) {
            //manually dumps data into data channel
            dumpCommand(message, args);
        }
        else if (enteredCommand == commands["generate"]) {
            generateCommand(message, args);
        }
        else if (enteredCommand == commands["react"]) {
            reactCommand(message);
        }
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function resetCommand(message, args) {
    await clearChannel(message.channel);
    await generateSignUpMessages(configjson["defaultCount"], getServerById(message.guild.id));
    players.resetPlayersSignUps();
}

/**
 * 
 * @param {Discord.Message | Discord.PartialMessage} message 
 * @param {string} args 
 */
async function dumpCommand(message, args) {
    startLoading(message);
    await collectAllSignUps();
    await dumpSignUps(getServerById(message.guild.id));
    endLoading(message, 0);
    deleteCommand(message);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function generateCommand(message, args) {
    deleteCommand(message);
    if (Number(args) <= 14) {
        await generateSignUpMessages(args ? args : configjson["defaultCount"], getServerById(message.guild.id));
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
    let messages = await message.channel.messages.fetch({ limit: 2 });
    let toReact = messages.last();
    await toReact.react(configjson["yesreaction"]);
    await toReact.react(configjson["noreaction"]);
    await deleteCommand(message);
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function gearChannelHandler(enteredCommand, message, commands) {
    if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
        commands = itemsjson["commands"]["gear"]["adv"];
        enteredCommand = enteredCommand.substr(1); // remove ?
        let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
        enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
        if (enteredCommand == commands["clear"]) {
            clearCommand(message);
        }
        else if (enteredCommand == commands["removeall"]) {
            removeAllCommand();
        }
        else if (enteredCommand == commands["remove"]) {
            removePlayerCommand(message, args);
        }
        else if (enteredCommand == commands["add"]) {
            manualAddCommand(args, message, commands);
        }
    }
    else if (!enteredCommand.startsWith("! ") && !enteredCommand.startsWith("?")) {
        let classToFind = itemsjson["classlist"].find(currentclassname => currentclassname == enteredCommand.split(" ")[0]);
        let firstSplit = enteredCommand.split(" ");
        if (firstSplit.length == 3) {
            shortUpdateGearCommand(message, firstSplit);
        }
        else {
            let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase(); // all but first word
            let split = args.split(" ");
            enteredCommand = enteredCommand.split(" ")[0]; // only first word
            commands = itemsjson["commands"]["gear"]["guest"];
            if (enteredCommand == commands["help"]) {
                helpCommand(message, true);
            }
            else if (enteredCommand == commands["succession"]) {
                succCommand(message);
            }
            else if (enteredCommand == commands["awakening"]) {
                awakCommand(message);
            }
            else if (enteredCommand == commands["axe"]) {
                axeCommand(message, args);
            }
            else if (enteredCommand == commands["horse"]) {
                horseCommand(message, args);
            }
            else if (classToFind) {
                updateGearCommand(split, commands, classToFind, message);
            }
            else {
                interactions.wSendAuthor(message.author, enteredCommand + " class not found.\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
            }

        }
    }
    deleteCommand(message);

    myServers.forEach(server => {
        //refresh bot message
        bot.setTimeout(async () => {
            await refreshBotMsg(server.myGear, server.botMsg, players);
        }, configjson["refreshDelay"]);
    });
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function clearCommand(message) {
    startLoading(message);
    if (message.channel instanceof Discord.TextChannel && message.channel.name.startsWith("trial-") && message.guild == myTrialServer) {
        historizeChannel(message.channel, myTrialHistory);
    } else {
        clearChannel(message.channel);
    }
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
                player.origin = message.guild.id;
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
    let ap = parseInt(firstSplit[0]);
    let aap = parseInt(firstSplit[1]);
    let dp = parseInt(firstSplit[2]);
    let playerFound = players.get(message.author.id);
    if (playerFound && playerFound instanceof Player &&
        Number.isInteger(ap) && ap >= 0 && ap < 400 &&
        Number.isInteger(aap) && aap >= 0 && aap < 400 &&
        Number.isInteger(dp) && dp >= 0 && dp < 600) {
        let player = new Player(message.member, playerFound.classname, ap, aap, dp, true);
        player.origin = message.guild.id;
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
            player.origin = message.guild.id;
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
    let playerFound = players.get(message.author.id);
    if (playerFound && playerFound instanceof Player
        && itemsjson["classlistSucc"].find(currentclassname => currentclassname == playerFound.classname)) {
        await updatePlayer(players, playerFound, true, message.author);
    }
    else {
        interactions.wSendAuthor(message.author, "Invalid command. Not registered to update to succession or not a succession class.");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function awakCommand(message) {
    let playerFound = players.get(message.author.id);
    if (playerFound && playerFound instanceof Player) {
        await updatePlayer(players, playerFound, false, message.author);
    }
    else {
        interactions.wSendAuthor(message.author, "Invalid command. Not registered to update to awakening.");
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function axeCommand(message, args) {
    let split = args.split(" ");
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
async function horseCommand(message, args) {
    let split = args.split(" ");
    if (split.length == 1) {
        await updatePlayerHorse(message.author, args);
    }
    else {
        // too many arguments !
        interactions.wSendAuthor(message.author, "Invalid horse command.");
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
        statsCommand(args, message);
    }
    else if (enteredCommand == commands["rankings"] && checkIntPermission(message)) {
        rankingsCommand(args, message);
    }
    else if (enteredCommand == commands["sub"]) {
        let rolename = args;
        //add roles here
        if (rolename == "rem" || rolename == "reminder" || rolename == "dnd") {
            await changeRole(message, rolename, args);
        }
    }
    else if (enteredCommand == commands["reminder"] && await checkAdvPermission(message)) {
        reminderCommand(message);
    }
    else if (enteredCommand == commands["attendance"] && await checkIntPermission(message)) {
        attendanceCommand(message);
    }
    else if (enteredCommand == commands["help"] && await checkIntPermission(message)) {
        helpCommand(message, false);
    }
    else if (enteredCommand == commands["clear"] && await checkAdvPermission(message)) {
        clearCommand(message);
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
        console.error(e);
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
        console.error(e);
        interactions.wSendAuthor(message.author, args + ' role not found or not self-assignable.');
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
function gearCommand(message, args) {
    startLoading(message);
    let idToFind = getPlayerByIdOrMention(message, args);
    let playerFound = players.get(idToFind);
    if (playerFound && playerFound instanceof Player) {
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
        interactions.wSendChannel(message.channel, players.getRankingsEmbed(null, message.guild.id));
        endLoading(message, 0);
    }
    else {
        let split = args.split(" ");
        if (itemsjson["classlist"].includes(split[0])) {
            // if it's a class
            startLoading(message);
            interactions.wSendChannel(message.channel, players.getRankingsEmbed(split[0], message.guild.id));
            endLoading(message, 0);
        } else if (split[0] == "all") {
            // if it's all origins
            startLoading(message);
            interactions.wSendChannel(message.channel, players.getRankingsEmbed());
            endLoading(message, 0);
        }
    }
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function statsCommand(args, message) {
    if (!args) {
        // if there are no arguments
        startLoading(message);
        interactions.wSendChannel(message.channel, players.getStatsEmbed(null, message.guild.id));
        endLoading(message, 0);
    }
    else {
        let split = args.split(" ");
        if (split.length == 1) {
            let idToFind = getPlayerByIdOrMention(message, split[0]);
            let playerFound = players.get(idToFind);
            if (playerFound && playerFound instanceof Player) {
                // if it's a player
                interactions.wSendChannel(message.channel, players.displayFullPlayerGS(playerFound));
            } else if (itemsjson["classlist"].includes(split[0])) {
                // if it's a class
                startLoading(message);
                interactions.wSendChannel(message.channel, players.getStatsEmbed(split[0], message.guild.id));
                endLoading(message, 0);
            } else if (split[0] == "all") {
                // if it's all origins
                startLoading(message);
                interactions.wSendChannel(message.channel, players.getStatsEmbed());
                endLoading(message, 0);
            } else {
                // if it's a day
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

function getPlayerByIdOrMention(message, id) {
    let idToFind;
    if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
        idToFind = message.mentions.members.first().id;
    } else {
        idToFind = id;
    }
    return idToFind;
}

/**
 * @param {Discord.Message | Discord.PartialMessage} message 
 */
async function reminderCommand(message) {
    let today = new Date();
    let day = today.getDay();
    let filteredPlayers = filterPlayersByServer(getServerById(message.guild.id));
    let naPlayers = await getPlayersWithStatus(day, filteredPlayers, "N/A");
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
    await collectAllSignUps();
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
    let messages = await fetchAllMessages(getMyServer().myAnnouncement);
    messages.forEach(async message => {
        message.reactions.cache.forEach(async reaction => {
            reaction.users.fetch();
        });
    });
    annCache.reference = messages;
}

async function cacheSignUps() {
    myServers.forEach(async server => {
        let messages = await fetchAllMessages(server.myAnnouncement);
        messages.forEach(message => {
            message.reactions.cache.forEach(async reaction => {
                reaction.users.fetch();
            });
        });
    });
}

async function cacheTrialMessage() {
    let messages = await fetchAllMessages(myTrial);
    messages.forEach(message => {
        message.reactions.cache.forEach(async reaction => {
            reaction.users.fetch();
        });
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
            users += user.toString() + "\n";
        });
        if (users) {
            embed.addField("Reacted with " + reaction.emoji.toString(), users, true);
        }
    });
    return embed;
}

/**
 * downloads files attached to the message and put it in download/messageid
 * @param {Discord.Message | Discord.PartialMessage} message
 */
async function downloadFilesFromMessage(message) {
    if (message.attachments.size > 0) {
        for (const iattachment of message.attachments) {
            let element = iattachment[1];
            try {
                if (!fs.existsSync("./download/" + message.id + "/")) {
                    fs.mkdirSync("./download/" + message.id + "/");
                }
                await files.download(element.url, "./download/" + message.id + "/" + element.name, () => { });
            } catch (e) {
                console.error(e);
                logger.logError("Could not download " + element.name + " file", e);
            }
        }
    }
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
 * @param {Server} server
 * generate num singup messages
 */
async function generateSignUpMessages(num, server) {
    for (let i = 0; i < num; i++) {
        let date = new Date();
        date.setDate(date.getDate() + i); // get the next day
        let content = util.findCorrespondingDayName(date.getDay()) + " - " + util.zeroString(date.getDate()) + "." + util.zeroString(date.getMonth() + 1) + "." + date.getFullYear();
        let message = await interactions.wSendChannel(server.mySignUp, content);
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
    myServers.forEach(server => {
        if(server.self.id != getMyServerGuildChannel().id) {
            bot.setTimeout(async () => {
                await dumpSignUps(server);
                setupSignUpSchedule();
            }, minUntilSave * 60 * 1000);
            logger.log("INFO: Sign ups save schedule set for " + server.self.name);
        }
    });
}

/**
 * gets a signup object from the message
 * @param {number} day 
 * @returns any[{ "name": [], "id": [], [dayStr]: [] }]
 */
async function getDaySignUp(day) {
    let signUps = [];
    for (let i = 0; i < myServers.length; i++) {
        let reactionMessage = await getDaySignUpMessage(day, myServers[i].mySignUp);
        if (reactionMessage) {
            let yesReaction = reactionMessage.reactions.cache.filter(reaction => reaction.emoji.name == configjson["yesreaction"]).first();
            let noReaction = reactionMessage.reactions.cache.filter(reaction => reaction.emoji.name == configjson["noreaction"]).first();
            if (noReaction) {
                let users = await noReaction.users.fetch();
                await Promise.all(users.map(async user => {
                    let member = await getMyServerGuildChannel().members.fetch(await bot.users.fetch(user.id));
                    if (intPermission(member)) {
                        addMemberToSignUps(member, signUps, "no");
                    }
                }));
            }
            if (yesReaction) {
                let users = await yesReaction.users.fetch();
                await Promise.all(users.map(async user => {
                    let member = await getMyServerGuildChannel().members.fetch(await bot.users.fetch(user.id));
                    if (intPermission(member)) {
                        addMemberToSignUps(member, signUps, "yes");
                    }
                }));
            }
            getMyServerGuildChannel().members.cache.forEach(member => {
                if (intPermission(member)) {
                    addMemberToSignUps(member, signUps, "N/A");
                }
            });
        }
    }
    return signUps;
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
    let messages = await fetchAllMessages(channel);
    message = messages.find(message => message.content.toLowerCase().startsWith(dateName));
    return message;
}

/**
 * @param {Discord.TextChannel} channel 
 * @param {number} limit
 * @return array containing all messages of the channel
 */
async function fetchAllMessages(channel, limit = 500) {
    const sum_messages = [];
    let last_id;

    while (true) {
        const options = { limit: 100 };
        if (last_id) {
            options.before = last_id;
        }

        const messages = await channel.messages.fetch(options);
        sum_messages.push(...messages.array());
        if (messages.last()) {
            last_id = messages.last().id;
        }

        if (messages.size != 100 || sum_messages.length >= limit) {
            break;
        }
    }
    return sum_messages;
}

async function collectAllSignUps() {
    for (let i = 0; i < myServers.length; i++) {
        await collectSignUps(myServers[i]);
    }
    logger.log("INFO: Signups collected");
}

/**
 * @param {Server} server 
 */
async function collectSignUps(server) {
    for (let day = 0; day < 7; day++) {
        let reactionMessage = await getDaySignUpMessage(day, server.mySignUp);
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
    /**
     * @type {Player[]}
     */
    let skippedUsers = [];
    await Promise.all(users.map(async (user) => {
        if (!user.bot) {
            try {
                let member = await reaction.message.guild.members.fetch(await bot.users.fetch(user.id));
                if (member && intPermission(member)) {
                    /**
                     * @type {Player}
                     */
                    let foundPlayer = players.get(member.id);
                    if (foundPlayer) {
                        if (foundPlayer.origin == reaction.message.guild.id) {
                            foundPlayer.setSignUpDay(day, emojiName);
                            foundPlayer.voted = true;
                        } else {
                            skippedUsers.push(foundPlayer);
                        }
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

    skippedUsers.forEach(player => {
        if (player.voted == false) {
            player.setSignUpDay(day, emojiName);
            player.voted = true;
        }
    });
}

/**
 * 
 * @param {Server} [server]
 */
async function dumpSignUps(server) {
    let sheetUpdateCommand = "!sheet update";
    let day = new Date();
    /**
     * @type {PlayerArray}
     */
    let filteredPlayers = filterPlayersByServer(server);
    let signUps = getFormattedSignUps(filteredPlayers);
    let signuppath = "./download/signups" + day.getTime() + ".csv";
    const csv = parse(signUps);
    files.writeToFile(signuppath, csv);
    let embedToSend = await getSignUpsEmbed(filteredPlayers);
    getMyServer().mySignUpData.send(sheetUpdateCommand, {
        files: [
            signuppath
        ]
    });
    server.mySignUpData.send(embedToSend);
}

/**
 * @param {Server} server 
 * @returns 
 */
function filterPlayersByServer(server) {
    let filteredPlayers;
    if (server.self.id == getMyServerGuildChannel().id) {
        let filter = players.filter(player => {
            return player.origin == getMyServerGuildChannel().id;
        });
        if (filter instanceof PlayerArray) {
            filteredPlayers = filter;
        }
    } else {
        filteredPlayers = players;
    }
    return filteredPlayers;
}

/**
 * @param {PlayerArray} players 
 * @returns 
 */
function getFormattedSignUps(players) {
    /**
     * @type {{id, name, class, ap, aap, dp, gs, succession, axe, horse}[]}
     */
    let signUps = [];
    players.forEach(player => {
        if (player instanceof Player && player.isReal()) {
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

/**
 * 
 * @param {any} playerInfo 
 * @param {Player} player 
 */
function addSignUpInfo(playerInfo, player) {
    let date = new Date();
    playerInfo.status = player.signUps[date.getDay()].status;
    for (let i = 0; i < 7; i++) {
        let date = player.signUps[i].date;
        playerInfo[util.findCorrespondingDayName(i)] = "";
        if (date) {
            playerInfo[util.findCorrespondingDayName(i)] = util.findCorrespondingDayName(date.getDay()) +
                " " + util.valueFormat(date.getHours(), 10) +
                ":" + util.valueFormat(date.getMinutes(), 10) +
                ' - ';
        }
        playerInfo[util.findCorrespondingDayName(i)] += player.signUps[i].status;
    }
}

/**
 * 
 * @param {PlayerArray} players 
 * @returns 
 */
async function getSignUpsEmbed(players) {
    let day = new Date();
    const embed = new Discord.MessageEmbed();
    let embedTitle = ":bookmark_tabs: SIGN UPS";
    let embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);
    let tooManyText = "Too many to show on Discord\nSee sheet for details";
    let tooMany = 66;
    let yesToSend = "";
    let yes = 0;
    players.forEach(element => {
        if (element.signUps[day.getDay()].status == "yes") {
            yesToSend += "<@" + element.id + ">" + "\n";
            yes++;
        }
    });
    if(yes > tooMany) {
        yesToSend = tooManyText;
    }

    let noToSend = "";
    let no = 0;
    players.forEach(element => {
        if (element.signUps[day.getDay()].status == "no") {
            noToSend += "<@" + element.id + ">" + "\n";
            no++;
        }
    });
    if(no > tooMany) {
        noToSend = tooManyText;
    }

    let naToSend = "";
    let na = 0;
    players.forEach(element => {
        if (element.real && element.signUps[day.getDay()].status == "N/A") {
            naToSend += "<@" + element.id + ">" + "\n";
            na++;
        }
    });
    if(na > tooMany) {
        naToSend = tooManyText;
    }
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
 * @param {Discord.User | Discord.PartialUser} issuer
 */
async function removePlayer(players, playerId, issuer) {
    let removed = players.remove(playerId);
    if (removed && removed instanceof Player) {
        let content = "";
        content += players.displayFullPlayer(removed[0]) + "\nRemoved from gear list.";
        content += "\n(Command issuer: " + issuer.toString() + ")";
        await interactions.wSendChannel(getServerById(removed.origin).myChangelog, content);
    }
}

/**
 * remove and add (readd) a player to a player list
 * @param {PlayerArray} players 
 * @param {Player} player 
 * @param {boolean} succ succ was true or not (null if no succ info given)
 * @param {Discord.User | Discord.PartialUser} issuer
 */
async function updatePlayer(players, player, succ, issuer) {
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
    content += "(Command issuer: " + issuer.toString() + ")";
    await interactions.wSendChannel(getServerById(player.origin).myChangelog, content);
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
    let playerFound = players.get(author.id);
    if (playerFound && playerFound instanceof Player) {
        let oldAxe = playerFound.getAxe(true);
        playerFound.setAxe(args);
        let content = "> Updated " + playerFound.getNameOrMention() + "'s axe :\n" + oldAxe + " -> " + playerFound.getAxe(true);
        await interactions.wSendChannel(getServerById(playerFound.origin).myChangelog, content);
    } else {
        await interactions.wSendAuthor(author, "You need to be registered to do that.");
    }
}

/**
 * updates a player's horse and logs it in changelog
 * @param {Discord.User} author 
 * @param {string} args 
 */
async function updatePlayerHorse(author, args) {
    let horseType = args.toLowerCase();
    let playerFound = players.get(author.id);
    if (playerFound && playerFound instanceof Player) {
        let oldPlayer = { ...playerFound };
        let content = "> Updated " + playerFound.getNameOrMention() + "'s horse :\n" + players.getHorseEmoji(oldPlayer) + " -> ";
        if (horseType && itemsjson['horselist'].includes(horseType) && playerFound.horse != horseType) {
            playerFound.horse = horseType;
            content += players.getHorseEmoji(playerFound);
            await interactions.wSendChannel(getServerById(playerFound.origin).myChangelog, content);
        } else if (horseType && horseType == "none") {
            playerFound.horse = "";
            content += "none";
            await interactions.wSendChannel(getServerById(playerFound.origin).myChangelog, content);
        }
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
 * @param {Discord.GuildChannel} channel the channel where the original message comes from
 * @param {{reference : Discord.Message}} botMsg the bot message
 * @param {PlayerArray} players
 * @returns the new message
 */
async function refreshBotMsg(channel, botMsg, players) {
    if (!botMsg.reference) {
        //no bot message to begin with, create a new one
        botMsg.reference = await newBotMessage(channel, filterOriginBotMessage(players, channel));
    } else {
        if (!await interactions.wEditMsg(botMsg.reference, filterOriginBotMessage(players, channel))) {
            //message probably got deleted or something, either way creating a new one
            logger.log("INFO: Couldn't find the existing bot message to edit, creating a new one");
            botMsg.reference = await newBotMessage(channel, filterOriginBotMessage(players, channel));
        }
    }
}

/**
 * @param {PlayerArray} players
 * @param {Discord.GuildChannel} channel 
 * @returns 
 */
function filterOriginBotMessage(players, channel) {
    return channel.guild.id == getMyServerGuildChannel().id ? players.getEmbed(getMyServerGuildChannel().id) : players.getEmbed();
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
    logger.log("INFO: Historizing " + channelSource.name);
    let messages = await fetchAllMessages(channelSource);
    if (messages.length > 0) {
        messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        let pdfPath = await createHistoryPDF(messages);
        let name = "";
        if (messages[0].mentions.users.first()) {
            name = " (" + messages[0].mentions.users.first().toString() + ")";
        }
        let historyMessage = "History of " + channelSource.name + name;
        let output = pdfPath.replace('.', 'o.');
        if (hasGs) {
            optimizePDF(pdfPath, output);
            files.uploadFileToChannel(output, channelDestination, historyMessage);
        } else {
            files.uploadFileToChannel(pdfPath, channelDestination, historyMessage);
        }
    }
    await clearChannel(channelSource);
}

/**
 * @param {Discord.Message[]} messages
 */
async function createHistoryPDF(messages) {
    return new Promise(async (resolve, reject) => {
        try {
            let fonts = getFonts();

            let PdfPrinter = require('pdfmake');
            let printer = new PdfPrinter(fonts);
            let fs = require('fs');

            let content = [];
            for (const message of messages) {
                let strDate = getFormattedDate(message.createdAt);
                content.push(message.author.username.toString() + " (" + strDate + ") : " + message.toString());
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
                logger.log('INFO: ' + pdfName + ' created');
                resolve(pdfName);
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}

var hasGs;
/**
 * make sure we have gs
 * maybe make this work for windows in the future idk
 */
function ghostScriptGet() {
    hasGs = Shell.exec('gs --help', { silent: true }).stdout.startsWith('GPL');
    let hasApt = Shell.exec('apt-get -h', { silent: true }).stdout.startsWith("apt");
    if (!hasGs && hasApt) {
        Shell.exec('apt-get install ghostscript', { silent: true });
        hasGs = Shell.exec('gs --help', { silent: true }).stdout.startsWith('GPL');
    }
    logger.log('CONFIG: GS ' + (hasGs ? 'ON' : 'OFF'));
}

/**
 * shell exec pts/pdfsizeopt to optimize a pdf's filesize
 * @param {string} input input path
 * @param {string} output output path
 */
function optimizePDF(input, output) {
    let dpi = 200;
    let shrinkpdf = 'gs					\
    -q -dNOPAUSE -dBATCH -dSAFER		\
    -sDEVICE=pdfwrite			\
    -dCompatibilityLevel=1.3		\
    -dPDFSETTINGS=/screen			\
    -dEmbedAllFonts=true			\
    -dSubsetFonts=true			\
    -dAutoRotatePages=/None		\
    -dColorImageDownsampleType=/Bicubic	\
    -dColorImageResolution='+ dpi + '		\
    -dGrayImageDownsapleType=/Bicubic	\
    -dGrayImageResolution='+ dpi + '		\
    -dMonoImageDownsampleType=/Subsample	\
    -dMonoImageResolution='+ dpi + '		\
    -sOutputFile="'+ output + '"			\
    "'+ input + '"';
    logger.log('EXEC:\n' + shrinkpdf);
    let code = Shell.exec(shrinkpdf).code;
    logger.log('RESULT:\n' + code);
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
        .replace('Y', date.getFullYear())
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
    let messages;
    do {
        messages = await channel.messages.fetch({ limit: 15 }, false, true);
        for (const imessage of messages) {
            let message = imessage[1];
            await message.delete();
        }
    } while (messages.size >= 2);
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
    let personId = "";
    let minUtilAlarm = util.getMinUntil(new Date().getDay(), 19, 45) * 60 * 1000;
    dailyTimeout(personId, minUtilAlarm, "Oublie pas les addons PvP");
    logger.log("INFO: Custom alarms set");
}

/**
 * send an alarm with a message in time minutes if the person at the id is signed up
 * @param {string} id
 * @param {number} time
 * @param {string} message
 */
function dailyTimeout(id, time, message) {
    bot.setTimeout(async () => {
        if (time > 0 && players.get(id) && players.get(id).signUps[new Date().getDay()].status == "yes") {
            interactions.wSendAuthor(getMyServerGuildChannel().members.cache.find(x => x.id == id).user, message);
            dailyTimeout(id, 86400000, message);
        } else {
            dailyTimeout(id, time + 86400000, message);
        }
    }, time);
}

/*
function setupAlarms() {
    let channel = myGuildChat;
    for (const key in alarmsjson) {
        let dayName = key;
        for (const hour in alarmsjson[dayName]) {
            let minUntilAlarm = mod(util.getMinUntil(util.findCorrespondingDayNumber(dayName.toLowerCase()), hour, 0), 10080);
            let msUntilAlarm = minUntilAlarm * 60 * 1000;
            let alarmText = getMyServer().roles.cache.find(x => x.name === "Rem").toString() + "\n";
            alarmsjson[dayName][hour].forEach(alarm => {
                alarmText += alarm + "\n";
            });
            bot.setTimeout(async () => {
                interactions.wSendChannel(channel, alarmText);
            }, msUntilAlarm);
        }
    }
    logger.log("INFO: Alarms set");
}*/

/**
 * The fundamental problem is in JS % is not the modulo operator. It's the remainder operator. There is no modulo operator in JavaScript.
 * @param {number} n 
 * @param {number} m 
 */
function mod(n, m) {
    return ((n % m) + m) % m;
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
    if (intPermission(message.member)) {
        allowed = true;
    }
    return allowed;
}

/**
 * @param {Discord.GuildMember} member 
 * @returns 
 */
function intPermission(member) {
    return member.roles.cache.find(x => x.name == "Members");
}

/**
 * whether the user has adv user permissions
 * @param {Discord.Message | Discord.PartialMessage} message the original message
 * @returns true if user is allowed, false if not
 */
async function checkAdvPermission(message) {
    let allowed = false;
    if (advPermission(message.member)) {
        allowed = true;
    } else {
        await interactions.wSendAuthor(message.author, 'Insufficient permissions.');
    }
    return allowed;
}

/**
 * @param {Discord.GuildMember} member 
 * @returns 
 */
function advPermission(member) {
    return member.roles.cache.find(x => x.name == "Officers") || member.roles.cache.find(x => x.name == "Officer");
}

/**
 * @param {string} id the player's id
 * @param {string} classname
 * @param {string} ap
 * @param {string} aap
 * @param {string} dp
 * @param {number} axe
 * @param {string} horse
 * @param {any[]} signUps
 * @param {boolean} real
 * @param {string} origin
 * @returns a player object with the given data
 */
async function revivePlayer(id, classname, ap, aap, dp, axe = 0, horse = undefined, signUps, real, origin = getMyServerGuildChannel().id) {
    try {
        let playerId = real ? await getMyServerGuildChannel().members.fetch(await bot.users.fetch(id)) : id;
        let newPlayer = new Player(playerId, classname, ap, aap, dp, real);

        newPlayer.origin = origin;
        newPlayer.horse = horse;
        newPlayer.setAxe(axe + "");
        if (signUps) {
            newPlayer.setSignUps(signUps);
        }
        return newPlayer;
    } catch (e) {
        console.error(e);
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
    try {
        let message = (await (await channel.messages.fetch({ limit: 1 })).first());
        if (message.content == configjson["gearDataMessage"] && message.attachments) {
            for (const iattachment of message.attachments) {
                let element = iattachment[1];
                if (element.name == filename) {
                    await files.download(element.url, "./download/" + filename, () => { });
                    logger.log("HTTP: " + filename + " downloaded");
                }
            }

        }
    } catch (e) {
        console.error(e);
        logger.logError("Could not download the file " + filename, e);
    }
}

/**
 * fetch an emoji from the server
 * @param {string} name 
 */
function fetchEmoji(name) {
    return myDevServer.emojis.cache.find(emoji => emoji.name == name);
}

/**
 * @param {number} index 
 */
function getConfigOrFirst(key, index) {
    return (configjson[key + index] ? configjson[key + index] : configjson[key]);
}

/**
 * @param {string} id
 * @returns the server if found, a new empty server if not
 */
function getServerById(id) {
    let serverFound = myServers.filter(server => {
        return server.self.id == id;
    });
    return serverFound ? serverFound[0] : new Server();
}

function getMyServer() {
    return myServers[0];
}

function getMyServerGuildChannel() {
    return myServers[0].self;
}

// ------ bot general behavior ------

//globals
const bot = new Discord.Client();
var configjsonfile = files.openJsonFile("./resources/config.json", "utf8");
var configjson = process.env.TOKEN ? configjsonfile["prod"] : configjsonfile["dev"];
var itemsjson = files.openJsonFile("./resources/items.json", "utf8");
/*var alarmsjson = files.openJsonFile("./resources/alarms.json", "utf8");*/
var init = false;

if (configjson && itemsjson) {
    // Initialize Discord Bot
    var token = process.env.TOKEN ? process.env.TOKEN : configjson["token"];
    bot.login(token);

    var playersjson;

    /**
     * @type Server[]
     */
    var myServers = [];
    //more globals
    /**
     * @type Server
     */
    var myServer = new Server();
    /**
     * @type Server
     */
    var myServer2 = new Server();
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
    var myGearData;

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
    var myTrialWelcome;

    myServers.push(myServer);
    myServers.push(myServer2);

    var players = new PlayerArray(itemsjson["classlist"], itemsjson["horselist"]);
    var classEmojis = [];
    var horseEmojis = [];
    var loading = 2000;

    bot.once("ready", async () => {
        logger.log("INFO: Logged in as " + bot.user.tag);
        bot.user.setPresence({ activity: { name: "booting up..." } });

        try {
            myTrialServer = bot.guilds.cache.get(configjson["botTrialServerID"]);
            myDevServer = bot.guilds.cache.get(configjsonfile["dev"]["botServerID"]);
            // @ts-ignore
            myGearData = await bot.channels.fetch(configjson["gearDataID"]);
            // @ts-ignore
            myTrial = await bot.channels.fetch(configjson["trialreactionID"]);
            // @ts-ignore
            myTrialHistory = await bot.channels.fetch(configjson["trialhistoryID"]);
            // @ts-ignore
            myTrialWelcome = await bot.channels.fetch(configjson["trialwelcomeID"]);

            let index = 0;
            for (let i = 0; i < myServers.length; i++) {
                let server = myServers[i];
                index++;
                server.self = bot.guilds.cache.get(getConfigOrFirst("botServerID", index));
                // @ts-ignore
                server.myGate = await bot.channels.fetch(getConfigOrFirst("gateID", index));
                // @ts-ignore
                server.myGear = await bot.channels.fetch(getConfigOrFirst("gearID", index));
                // @ts-ignore
                server.mySignUp = await bot.channels.fetch(getConfigOrFirst("signUpID", index));
                // @ts-ignore
                server.mySignUpData = await bot.channels.fetch(getConfigOrFirst("signUpDataID", index));
                // @ts-ignore
                server.myAnnouncement = await bot.channels.fetch(getConfigOrFirst("announcementID", index));
                // @ts-ignore
                server.myAnnouncementData = await bot.channels.fetch(getConfigOrFirst("announcementDataID", index));
                // @ts-ignore
                server.myWelcome = await bot.channels.fetch(getConfigOrFirst("welcomeID", index));
                // @ts-ignore
                server.myChangelog = await bot.channels.fetch(getConfigOrFirst("changelogID", index));
                // @ts-ignore
                server.myGuildChat = await bot.channels.fetch(getConfigOrFirst("guildchatID", index));
            }

            logger.log("INFO: Booting up attempt...");
            if (myServers) {
                initEmojis();

                //attempt to load a previously saved state
                players = await initPlayers(players);

                logger.log("INFO: ... success !");

                if (!init) {
                    initLookout();
                    init = true;
                } else {
                    logger.log("INFO: Lookout already started");
                }
            } else {
                logger.log("...failed, retrying in " + loading + "ms");
            }
        } catch (e) {
            console.error(e);
        }
    });
} else {
    logger.log("INFO: Couldn't find config.json and items.json files, aborting.");
}
async function initPlayers(players) {
    try {
        await downloadGearFileFromChannel("players.json", myGearData);
        playersjson = files.openJsonFile("./download/players.json", "utf8");
        if (playersjson) {
            for (const currentPlayer of playersjson) {
                let revivedPlayer = await revivePlayer(
                    currentPlayer["id"],
                    currentPlayer["classname"],
                    currentPlayer["ap"],
                    currentPlayer["aap"],
                    currentPlayer["dp"],
                    currentPlayer["axe"],
                    currentPlayer["horse"],
                    currentPlayer["signUps"],
                    currentPlayer["real"],
                    currentPlayer["origin"]
                );
                if (revivedPlayer) {
                    players.add(revivedPlayer);
                }
            }
        }
        return players;
    } catch (e) {
        console.error(e);
        logger.log("INFO: Players file not found");
    }
}

async function initEmojis() {
    itemsjson["classlist"].forEach(async (classname) => {
        classEmojis.push(fetchEmoji(classname));
    });
    itemsjson["classlistSucc"].forEach(async (classname) => {
        classEmojis.push(fetchEmoji(classname + "Succ"));
    });
    itemsjson["horselist"].forEach(async (horsename) => {
        horseEmojis.push(fetchEmoji(horsename));
    });
    players.setClassEmojis(classEmojis);
    players.setHorseEmojis(horseEmojis);
}

