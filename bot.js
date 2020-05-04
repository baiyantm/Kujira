// @ts-check
const fs = require('fs');
const { parse } = require('json2csv');
const Discord = require("discord.js");
const files = require("./modules/files");
const interactions = require("./modules/interactions");
const logger = require("./modules/logger");
const util = require("./modules/util");
var Player = require('./classes/Player');
var PlayerArray = require('./classes/PlayerArray');

async function initLookout() {
    logger.log("INFO: Initializing lookout ...");

    bot.user.setPresence({ game: { name: "up" } });

    if (myAnnouncement) {
        setupPresence();
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
    await myGear.fetchMessages({ limit: 100 }).then(messages => {
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

    bot.on("messageReactionAdd", async messageReaction => onReactionHandler(messageReaction));

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
                const channel = bot.channels.get(packet.d.channel_id);
                // There's no need to emit if the message is cached, because the event will fire anyway for that
                // @ts-ignore
                if (channel.messages.has(packet.d.message_id)) return;
                // Since we have confirmed the message is not cached, let's fetch it
                // @ts-ignore
                channel.fetchMessage(packet.d.message_id).then(message => {
                    // Emojis can have identifiers of name:id format, so we have to account for that case as well
                    const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
                    // This gives us the reaction we need to emit the event properly, in top of the message object
                    const reaction = message.reactions.get(emoji);
                    // Adds the currently reacting user to the reaction's users collection.
                    if (reaction) reaction.users.set(packet.d.user_id, bot.users.get(packet.d.user_id));
                    // Check which type of event it is before emitting
                    bot.emit('messageReactionAdd', reaction, bot.users.get(packet.d.user_id));
                });
            } else if (['MESSAGE_UPDATE'].includes(packet.t)) {
                const channel = bot.channels.get(packet.d.channel_id);
                // There's no need to emit if the message is cached, because the event will fire anyway for that
                // @ts-ignore
                if (channel.messages.has(packet.d.id)) return;
                // Since we have confirmed the message is not cached, let's fetch it
                // @ts-ignore
                channel.fetchMessage(packet.d.id).then(message => {
                    bot.emit('messageUpdate', null, message);
                });
            } else if (['MESSAGE_DELETE'].includes(packet.t)) {
                const channel = bot.channels.get(packet.d.channel_id);
                // There's no need to emit if the message is cached, because the event will fire anyway for that
                // @ts-ignore
                if (channel.messages.has(packet.d.id)) return;
                // Since we have confirmed the message is not cached, let's fetch it
                // @ts-ignore
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
    }

    process.on('SIGTERM', async function () {
        logger.log("Recieved signal to terminate, saving and shutting down");
        if (myGear.id && myGearData.id) {
            await savePlayers();
        }
        await bot.destroy();
        process.exit(0);
    });

    logger.log("INFO: ... lookout initialization done");
}

/**
 * listener for member leaving guild
 * @param {Discord.GuildMember} member 
 */
async function onLeaveHandler(member) {
    if (member.guild.id == myServer.id) {
        interactions.wSendChannel(myWelcome, member + "(" + member.user.username + ") has left the server.");
    }
}

/**
 * listener for message edit
 * @param {Discord.Message} newMessage 
 * @param {{reference : any}} annCache 
 */
async function onEditHandler(newMessage, annCache) {
    if (newMessage.channel.id == myAnnouncement.id) {
        await cacheAnnouncements(annCache);
    }
}

/**
 * listener for message delete
 * @param {Discord.Message} deletedMessage 
 * @param {{reference : any}} annCache 
 */
async function onDeleteHandler(deletedMessage, annCache) {
    if (deletedMessage.channel.id == myAnnouncement.id) {
        await interactions.wSendChannel(myAnnouncementData, await getHistoryEmbed(deletedMessage));
        await cacheAnnouncements(annCache);
    }
}

/**
 * listener for emoji add event
 * @param {Discord.MessageReaction} messageReaction 
 */
async function onReactionHandler(messageReaction) {
    if (messageReaction.message.channel.id == mySignUp.id) {
        let message = messageReaction.message;
        let yesReaction = message.reactions.filter(messageReaction => messageReaction.emoji.name == configjson["yesreaction"]).first();
        let noReaction = message.reactions.filter(messageReaction => messageReaction.emoji.name == configjson["noreaction"]).first();
        if (messageReaction.emoji.name == configjson["noreaction"]) {
            let user = noReaction.users.last();
            if (user.id != bot.user.id && (await noReaction.fetchUsers()).get(user.id)) {
                if (yesReaction) {
                    yesReaction.remove(user);
                }
            }
        }
        if (messageReaction.emoji.name == configjson["yesreaction"]) {
            let user = yesReaction.users.last();
            if (user.id != bot.user.id && (await yesReaction.fetchUsers()).get(user.id)) {
                if (noReaction) {
                    noReaction.remove(user);
                }
            }
        }
    }
}

/**
 * listener for message event
 * @param {Discord.Message} message the message sent
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
            if (enteredCommand == commands["ok"]) {
                let publicRole = message.guild.roles.find(x => x.name == "Public");
                if (!message.member.roles.has(publicRole.id)) {
                    await message.member.addRole(publicRole);
                    logger.log("ROLE: " + publicRole + " role added to " + message.author.tag);
                    await interactions.wSendAuthor(message.author, itemsjson["urlguildpage"]);
                    await interactions.wSendAuthor(message.author, itemsjson["gateguide"] + "\n\nReminder that you agreed to the following rules :\n" + itemsjson["gaterules"]);
                    await interactions.wSendChannel(myWelcome, message.author + " agreed to the rules and got the public role.");
                }
            }
            deleteCommand(message);
        } else if (message.channel.id == mySignUp.id) {
            // === SIGNUP ===
            if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
                commands = itemsjson["commands"]["signup"]["adv"];
                enteredCommand = enteredCommand.substr(1);
                let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
                if (enteredCommand == commands["clear"]) {
                    await clearChannel(message.channel);
                } else if (enteredCommand == commands["reset"]) {
                    await clearChannel(message.channel);
                    if (args == "bulk") {
                        await bulkSignUpMessages(configjson["defaultDay"]);
                    } else {
                        await generateSignUpMessages(configjson["defaultCount"]);
                    }
                } else if (enteredCommand == commands["dump"]) {
                    //manually dumps data into data channel
                    deleteCommand(message);
                    let day;
                    if (args) {
                        day = util.findCorrespondingDayNumber(args);
                    } else {
                        let today = new Date();
                        day = today.getDay();
                    }
                    await saveSignUp(day);
                } else if (enteredCommand == commands["bulk"]) {
                    deleteCommand(message);
                    await bulkSignUpMessages(args ? args : configjson["defaultDay"]);
                } else if (enteredCommand == commands["generate"]) {
                    deleteCommand(message);
                    if (Number(args) <= 7) {
                        await generateSignUpMessages(args ? args : configjson["defaultCount"]);
                    } else {
                        interactions.wSendAuthor(message.author, "I cannot generate that many messages");
                    }
                } else if (enteredCommand == commands["react"]) {
                    await message.channel.fetchMessages({ limit: 2 }).then(async messages => {
                        let toReact = messages.last();
                        await toReact.react(configjson["yesreaction"]);
                        await toReact.react(configjson["noreaction"]);
                    });
                    await deleteCommand(message);
                }
            }
        } else if (message.channel.id == myGear.id) {
            // === GEAR ===
            if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
                commands = itemsjson["commands"]["gear"]["adv"];
                enteredCommand = enteredCommand.substr(1); // remove ?
                let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
                if (enteredCommand == commands["clear"]) {
                    await clearChannel(message.channel);
                } else if (enteredCommand == commands["removeall"]) {
                    players.length = 0;
                } else if (enteredCommand == commands["remove"]) {
                    let playerId = "";
                    if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
                        playerId = message.mentions.members.first().id;
                    } else {
                        playerId = args;
                    }
                    await removePlayer(players, playerId, message.author);
                } else if (enteredCommand == commands["add"]) {
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
                                } else if (split[0].startsWith(commands["awakening"])) {
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
                                    player = new Player(name, classToFind, ap, aap, dp, false, false);
                                } else {
                                    player = new Player(member, classToFind, ap, aap, dp, false, true);
                                }
                                await updatePlayer(players, player, succ, message.author);
                            } else {
                                interactions.wSendAuthor(message.author, "Some stats are too high or not numbers.");
                            }
                        } else {
                            interactions.wSendAuthor(message.author, split[0] + " class not found.\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
                        }
                    } else {
                        interactions.wSendAuthor(message.author, "Incorrect format. Correct format is `<name> <classname> [succession|awakening] <ap> <aap> <dp>`\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
                    }
                }
            } else if (!enteredCommand.startsWith("! ") && !enteredCommand.startsWith("?")) {
                commands = itemsjson["commands"]["gear"]["guest"];
                if (enteredCommand == commands["help"]) {
                    let helpMessage = await interactions.wSendChannel(message.channel, itemsjson["gearhelp"]);
                    bot.setTimeout(() => {
                        interactions.wDelete(helpMessage);
                    }, 60000);
                } else {
                    let classToFind = itemsjson["classlist"].find(currentclassname => currentclassname == enteredCommand.split(" ")[0]);
                    if (classToFind) {
                        let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase(); // remove classname
                        let split = args.split(" ");
                        let succ = null;
                        if (split.length == 4) {
                            if (split[0].startsWith(commands["succession"]) &&
                                itemsjson["classlistSucc"].find(currentclassname => currentclassname == classToFind)) {
                                succ = true;
                            } else if (split[0].startsWith(commands["awakening"])) {
                                succ = false;
                            }
                            split.splice(0, 1); // remove succ
                        }
                        if (split.length == 3) {
                            let ap = parseInt(split[0]);
                            let aap = parseInt(split[1]);
                            let dp = parseInt(split[2]);
                            if (Number.isInteger(ap) && ap >= 0 && ap < 400 && Number.isInteger(aap) && aap >= 0 && aap < 400 && Number.isInteger(dp) && dp >= 0 && dp < 600) {
                                let player = new Player(message.member, classToFind, ap, aap, dp, false, true);
                                await updatePlayer(players, player, succ, message.author);
                            } else {
                                interactions.wSendAuthor(message.author, "Some stats are too high or not numbers.");
                            }
                        } else {
                            interactions.wSendAuthor(message.author, "Incorrect format. Correct format is `<classname> [succession|awakening] <ap> <aap> <dp>`\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
                        }
                    } else {
                        interactions.wSendAuthor(message.author, enteredCommand.split(" ")[0] + " class not found.\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
                    }

                }
            }
            deleteCommand(message);

            //refresh bot message
            bot.setTimeout(async () => {
                await refreshBotMsg(myGear, botMsg, players);
            }, configjson["refreshDelay"]);
        } else {
            // === ALL CHANNELS ===
            if (enteredCommand.startsWith("?")) {
                commands = itemsjson["commands"]["any"]["guest"];
                enteredCommand = enteredCommand.substr(1);
                let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
                if (enteredCommand == commands["gear"] && checkIntPermission(message)) {
                    message.react("✅");
                    let idToFind;
                    if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
                        idToFind = message.mentions.members.first().id;
                    } else {
                        idToFind = args;
                    }
                    let playerFound = players.get(idToFind);
                    if (playerFound) {
                        interactions.wSendChannel(message.channel, players.displayFullPlayer(playerFound));
                    } else {
                        interactions.wSendChannel(message.channel, "Couldn't find this player.");
                    }
                } else if (enteredCommand == commands["stats"] && checkIntPermission(message)) {
                    if (!args) {
                        message.react("✅");
                        interactions.wSendChannel(message.channel, players.getStatsEmbed(null));
                    } else {
                        let split = args.split(" ");
                        if (split.length == 1) {
                            if (itemsjson["classlist"].includes(split[0])) {
                                message.react("✅");
                                interactions.wSendChannel(message.channel, players.getStatsEmbed(split[0]));
                            } else {
                                let day;
                                if (split[0]) {
                                    if (split[0] == "today") {
                                        let today = new Date();
                                        day = today.getDay();
                                    } else if (util.findCorrespondingDayNumber(split[0]) != null) {
                                        day = util.findCorrespondingDayNumber(split[0]);
                                    }
                                    if (day != undefined) {
                                        message.react("✅");
                                        let signedUpPlayers = await getPlayersWithStatus(day, players, "yes");
                                        if (signedUpPlayers) {
                                            interactions.wSendChannel(message.channel, players.getSignedUpStatsEmbed(signedUpPlayers, day));
                                        } else {
                                            interactions.wSendChannel(message.channel, "No message found for " + util.findCorrespondingDayName(day));
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else if (enteredCommand == commands["sub"]) {
                    let rolename = args;
                    //add roles here
                    if (false) {
                        let role = message.guild.roles.find(x => x.name == rolename.charAt(0).toUpperCase() + rolename.slice(1));
                        if (message.member.roles.has(role.id)) {
                            try {
                                await message.member.removeRole(role);
                                interactions.wSendAuthor(message.author, role.name + ' role removed.');
                                logger.log('ROLE: ' + role.name + ' role removed from ' + message.author.tag);
                                interactions.wDelete(message);
                            } catch (e) {
                                interactions.wSendAuthor(message.author, args + ' role not found or not self-assignable.');
                            }
                        } else {
                            try {
                                await message.member.addRole(role);
                                interactions.wSendAuthor(message.author, role.name + ' role added.');
                                logger.log('ROLE: ' + role.name + ' role added to ' + message.author.tag);
                                interactions.wDelete(message);
                            } catch (e) {
                                interactions.wSendAuthor(message.author, args + ' role not found or not self-assignable.');
                            }
                        }
                    }
                } else if (enteredCommand == commands["reminder"] && checkAdvPermission(message)) {
                    let today = new Date();
                    let day = today.getDay();
                    let naPlayers = await getPlayersWithStatus(day, players, "N/A");
                    let reminderMessage = "";
                    if (naPlayers.length > 0) {
                        naPlayers.forEach(player => {
                            reminderMessage += "<@" + player.id + ">\n";
                        });
                        reminderMessage += "Please vote for today :)";
                    } else {
                        reminderMessage += "Everyone voted for today 👍";
                    }
                    interactions.wSendChannel(message.channel, reminderMessage);
                }
            }
        }
    } catch (e) {
        logger.logError("On message listener error. Something really bad went wrong", e);
    }
}

/*
--------------------------------------- HISTORY section ---------------------------------------
*/

/**
 * @param {{reference : any}} annCache 
 */
async function cacheAnnouncements(annCache) {
    await myAnnouncement.fetchMessages({ limit: 100 }).then(messages => {
        messages.forEach(async message => {
            await message.reactions.forEach(async reaction => {
                await reaction.fetchUsers();
            });
        });
        annCache.reference = messages;
    });
}

/**
 * @param {Discord.Message} message 
 * @returns an embed containing info about the message
 */
async function getHistoryEmbed(message) {
    const embed = new Discord.RichEmbed();
    let embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setAuthor(message.author.tag, message.author.avatarURL);
    embed.setDescription(message.content);
    embed.setTimestamp(message.editedTimestamp ? message.editedTimestamp : message.createdTimestamp);
    message.attachments.forEach(attachment => {
        embed.attachFile("./download/" + message.id + "/" + attachment.filename);
    });
    message.reactions.forEach(async reaction => {
        let users = "";
        reaction.users.forEach(user => {
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
 * @param {Discord.Message} message
 */
async function downloadFilesFromMessage(message) {
    return new Promise(async (resolve, reject) => {
        if (message.attachments.size > 0) {
            await message.attachments.forEach(async element => {
                try {
                    if (!fs.existsSync("./download/" + message.id + "/")) {
                        fs.mkdirSync("./download/" + message.id + "/");
                    }
                    await files.download(element.url, "./download/" + message.id + "/" + element.filename, () => { });
                    resolve();
                } catch (e) {
                    logger.logError("Could not download " + element.filename + " file", e);
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
async function getReactions(messageReactions) {
    let res = "";
    messageReactions.forEach(reaction => {
        //TODO
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
        let today = new Date();
        await saveSignUp(today.getDay());
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
                let member = await myServer.fetchMember(await bot.fetchUser(user.id));
                if (member.roles.find(x => x.name == "Members")) {
                    addMemberToSignUps(member, signUps, "no");
                }
            }));
        }
        if (yesReaction) {
            let users = await yesReaction.fetchUsers();
            await Promise.all(users.map(async user => {
                let member = await myServer.fetchMember(await bot.fetchUser(user.id));
                if (member.roles.find(x => x.name == "Members")) {
                    addMemberToSignUps(member, signUps, "yes");
                }
            }));
        }
        myServer.members.forEach(member => {
            if (member.roles.find(x => x.name == "Members")) {
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
    await channel.fetchMessages({ limit: 100 }).then(async messages => {
        message = await messages.find(message => message.content.toLowerCase().startsWith(dateName));
    });
    return message;
}

async function cleanMissingMembersFromSignups(day) {
    let found = false;
    let reactionMessage = await getDaySignUpMessage(day, mySignUp);
    let yesReaction = reactionMessage.reactions.filter(messageReaction => messageReaction.emoji.name == configjson["yesreaction"]).first();
    let noReaction = reactionMessage.reactions.filter(messageReaction => messageReaction.emoji.name == configjson["noreaction"]).first();
    let users = await noReaction.fetchUsers();
    await Promise.all(users.map(async user => {
        try {
            await myServer.fetchMember(await bot.fetchUser(user.id));
        } catch (e) {
            noReaction.remove(user);
            yesReaction.remove(user);
            found = true;
        }
    }));
    if (!found) {
        users = await yesReaction.fetchUsers();
        await Promise.all(users.map(async user => {
            try {
                await myServer.fetchMember(await bot.fetchUser(user.id));
                found = true;
            } catch (e) {
                noReaction.remove(user);
                yesReaction.remove(user);
                found = true;
            }
        }));
    }
    if (!found) {
        await interactions.wSendChannel(mySignUpData, "There was an error. I tried but I couldn't fix it, sorry :(");
    }
}

/**
 * @param {number} day 
 */
async function saveSignUp(day) {
    let dayStr = util.findCorrespondingDayName(day);
    try {
        let signUps = await getDaySignUp(day);
        if (signUps) {
            signUps.sort((a, b) => {
                var nameA = a.name.toLowerCase(), nameB = b.name.toLowerCase();
                if (nameA < nameB) //sort string ascending
                    return -1;
                if (nameA > nameB)
                    return 1;
                return 0; //default return value (no sorting)
            });
            let signuppath = "./download/signups" + dayStr + ".csv";
            const csv = parse(signUps);
            files.writeToFile(signuppath, csv);
            mySignUpData.send({
                embed: await getSignUpsEmbed(signUps),
                files: [
                    signuppath
                ]
            });
        } else {
            interactions.wSendChannel(mySignUpData, "No message found for " + util.findCorrespondingDayName(day));
        }
    } catch (e) {
        if (e.message == 'Unknown Member') {
            await cleanMissingMembersFromSignups(day);
            await saveSignUp(day);
        } else {
            throw e;
        }
    }
}

async function getSignUpsEmbed(signUps) {
    let dayStr = Object.keys(signUps[0])[2];
    const embed = new Discord.RichEmbed();
    let embedTitle = ":bookmark_tabs: SIGN UPS";
    let embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);
    let yesToSend = "";
    let yes = 0;
    signUps.forEach(element => {
        if (element.status == "yes") {
            yesToSend += "<@" + element.id + ">" + "\n";
            yes++;
        }
    });

    let noToSend = "";
    let no = 0;
    signUps.forEach(element => {
        if (element.status == "no") {
            noToSend += "<@" + element.id + ">" + "\n";
            no++;
        }
    });

    let naToSend = "";
    let na = 0;
    signUps.forEach(element => {
        if (element.status == "N/A") {
            naToSend += "<@" + element.id + ">" + "\n";
            na++;
        }
    });
    if (yesToSend) {
        embed.addField(configjson["yesreaction"] + " YES (" + yes + ")", yesToSend, true);
    }
    if (noToSend) {
        embed.addField(configjson["noreaction"] + " NO (" + no + ")", noToSend, true);
    }
    if (naToSend) {
        embed.addField(":question:" + " N/A (" + na + ")", naToSend, true);
    }
    embed.setTimestamp()
    return embed;
}

/*
--------------------------------------- GEAR section ---------------------------------------
*/

/**
 * remove a player from a player list
 * @param {PlayerArray} players 
 * @param {string} playerId 
 * @param {Discord.GuildMember} origin
 */
async function removePlayer(players, playerId, origin) {
    let removed = players.remove(playerId);
    if (removed) {
        let content = "";
        content += playerId + " removed from gear list.";
        content += "\n(Command origin: " + origin + ")";
        await interactions.wSendChannel(myChangelog, content);
    }
}

/**
 * remove and add (readd) a player to a player list
 * @param {PlayerArray} players 
 * @param {Player} player 
 * @param {boolean} succ succ was true or not (null if no succ info given)
 * @param {Discord.GuildMember} origin
 */
async function updatePlayer(players, player, succ, origin) {
    let oldPlayer = players.filter(currentPlayer => currentPlayer.equals(player))[0];
    let content = "";
    content += player.getNameOrMention() + "** gear update**\n> Old: " + (oldPlayer ? players.displayFullPlayer(oldPlayer) : "N/A") + "\n> New: " + players.displayFullPlayer(player);
    content += "\n(Command origin: " + origin + ")";
    await interactions.wSendChannel(myChangelog, content);
    players.findAndUpdate(player, succ);
}

async function savePlayers() {
    let playerspath = "./download/players.json";
    await files.writeObjectToFile(playerspath, players);
    await files.uploadFileToChannel(playerspath, myGearData, configjson["gearDataMessage"]);
}

/**
 * if the bot message exists, edits it
 * if not, sends a new one
 * @param {Discord.Message} channel the channel where the original message comes from
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
 * deletes all messages in the channel
 * @param {Discord.TextChannel|Discord.DMChannel|Discord.GroupDMChannel} channel the channel to clean
 */
async function clearChannel(channel) {
    let deleteCount = 100;
    try {
        channel.bulkDelete(deleteCount, true);
        logger.log("INFO: Deleted " + deleteCount + " messages in " + channel);
    } catch (e) {
        logger.logError("bulkDelete error", e);
    }
}

/*
--------------------------------------- GENERAL section ---------------------------------------
*/

async function setupPresence() {
    bot.setInterval(async () => {
        await myAnnouncement.fetchMessages({ limit: 1 }).then(messages => {
            let message = messages.first();
            let issuedTimestamp = message.editedTimestamp ? message.editedTimestamp : message.createdTimestamp;
            let startDate = new Date();
            let seconds = (issuedTimestamp - startDate.getTime()) / 1000;
            let presence = Math.abs(seconds) > 86400 ? "Remedy" : "Announcement " + util.displayHoursMinBefore(Math.abs(Math.round(seconds / 60))) + " ago";
            try {
                bot.user.setPresence({
                    game:
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
 * @param {Discord.Message} message 
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
 * @param {Discord.Message} message the original message
 * @returns true if user is allowed, false if not
 */
function checkIntPermission(message) {
    let allowed = false;
    if (message.member.roles.find(x => x.name == "Members")) {
        allowed = true;
    }
    return allowed;
}

/**
 * whether the user has adv user permissions
 * @param {Discord.Message} message the original message
 * @returns true if user is allowed, false if not
 */
async function checkAdvPermission(message) {
    let allowed = false;
    if (message.member.roles.find(x => x.name == "Officers")) {
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
 * @param {boolean} hidden
 * @returns a player object with the given data
 */
async function revivePlayer(id, classname, ap, aap, dp, hidden, real) {
    let playerId = real ? await myServer.fetchMember(await bot.fetchUser(id)) : id;
    return new Player(playerId, classname, ap, aap, dp, hidden, real);
}

/**
 * downloads a file attached to the last message of the channel and put it in download/
 * @param {string} filename the file's name
 * @param {Discord.TextChannel} channel the channel to download from
 */
async function downloadGearFileFromChannel(filename, channel) {
    return new Promise((resolve, reject) => {
        channel.fetchMessages({ limit: 1 }).then(async messages => {
            messages.forEach(message => {
                if (message.content == configjson["gearDataMessage"] && message.attachments) {
                    message.attachments.forEach(async element => {
                        if (element.filename == filename) {
                            logger.log("HTTP: Downloading " + filename + " ...");
                            try {
                                await files.download(element.url, "./download/" + filename, () => { });
                                logger.log("HTTP: ...success !");
                                resolve();
                            } catch (e) {
                                logger.logError("Could not download the file", e);
                                reject();
                            }
                        }
                    });

                }
            });
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
async function fetchEmoji(name) {
    return new Promise((resolve, reject) => {
        try {
            myDevServer.emojis.find(emoji => {
                if (emoji.name == name) {
                    resolve(emoji);
                }
            });
        } catch (e) {
            reject(name);
        }
        setTimeout(() => {
            reject(name);
        }, 10000);
    });
}

// ------ bot general behavior ------

//globals
const bot = new Discord.Client();
var configjsonfile = files.openJsonFile("./resources/config.json", "utf8");
var configjson = process.env.TOKEN ? configjsonfile["prod"] : configjsonfile["dev"];
var itemsjson = files.openJsonFile("./resources/items.json", "utf8");
var init = false;

if (configjson && itemsjson) {
    // Initialize Discord Bot
    var token = process.env.TOKEN ? process.env.TOKEN : configjson["token"];
    bot.login(token);

    //more globals
    var myServer;
    var myDevServer;
    var myGate;
    var myGear;
    var myGearData;
    var mySignUp;
    var mySignUpData;
    var myAnnouncement;
    var myAnnouncementData;
    var myWelcome;
    var myChangelog;
    var players = new PlayerArray(itemsjson["classlist"]);
    var classEmojis = [];
    var loading = 1000;

    bot.once("ready", async () => {
        logger.log("INFO: Logged in as " + bot.user.tag);
        bot.user.setPresence({ game: { name: "booting up..." } });

        myServer = bot.guilds.get(configjson["botServerID"]);
        myDevServer = bot.guilds.get(configjsonfile["dev"]["botServerID"]);
        myGearData = bot.channels.get(configjson["gearDataID"]);

        itemsjson["classlist"].forEach(async classname => {
            classEmojis.push(await fetchEmoji(classname));
        });
        itemsjson["classlistSucc"].forEach(async classname => {
            classEmojis.push(await fetchEmoji(classname + "Succ"));
        });
        players.setClassEmojis(classEmojis);

        //attempt to load a previously saved state
        try {
            // @ts-ignore
            await downloadGearFileFromChannel("players.json", myGearData);
        } catch (e) {
            logger.log("INFO: Couldn't find or download the players file");
        }
        var playersjson = files.openJsonFile("./download/players.json", "utf8");
        if (playersjson) {
            playersjson.forEach(async currentPlayer => {
                players.add(await revivePlayer(currentPlayer["id"], currentPlayer["classname"], currentPlayer["ap"], currentPlayer["aap"], currentPlayer["dp"], currentPlayer["hidden"], currentPlayer["real"]));
            });
        }

        logger.log("INFO: Starting in " + loading + "ms");
        var interval = setInterval(async () => {
            myServer = bot.guilds.get(configjson["botServerID"]);
            myDevServer = bot.guilds.get(configjsonfile["dev"]["botServerID"]);
            myGate = bot.channels.get(configjson["gateID"]);
            myGear = bot.channels.get(configjson["gearID"]);
            myGearData = bot.channels.get(configjson["gearDataID"]);
            mySignUp = bot.channels.get(configjson["signUpID"]);
            mySignUpData = bot.channels.get(configjson["signUpDataID"]);
            myAnnouncement = bot.channels.get(configjson["announcementID"]);
            myAnnouncementData = bot.channels.get(configjson["announcementDataID"]);
            myWelcome = bot.channels.get(configjson["welcomeID"]);
            myChangelog = bot.channels.get(configjson["changelogID"]);

            logger.log("INFO: Booting up attempt...");
            if (myServer && myDevServer && myGate && myGear && myGearData && classEmojis && mySignUp
                && mySignUpData && myAnnouncement && myAnnouncementData && myWelcome && myChangelog) {
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
            }
        }, loading);

    });
} else {
    logger.log("INFO: Couldn't find config.json and items.json files, aborting.")
}
