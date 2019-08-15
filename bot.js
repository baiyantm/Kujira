// @ts-check
const fs = require('fs');
const { parse } = require('json2csv');
const Discord = require("discord.js");
const files = require("./modules/files");
const interactions = require("./modules/interactions");
const logger = require("./modules/logger");
const util = require("./modules/util");
var Player = require('./classes/Player');

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
 * listener for message edit
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
                enteredCommand = enteredCommand.substr(1);
                let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
                if (enteredCommand == commands["clear"]) {
                    await clearChannel(message.channel);
                } else if (enteredCommand == commands["removeall"]) {
                    players = [];
                } else if (enteredCommand == commands["remove"]) {
                    if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
                        let player = new Player(message.mentions.members.first());
                        players = await removePlayer(players, player, message.author);
                    } else {
                        let player = new Player();
                        player.name = args;
                        players = await removePlayer(players, player, message.author);
                    }
                } else if (enteredCommand == commands["add"]) {
                    let split = args.split(" ");
                    if (split.length == 5) {
                        let member = null;
                        if (message.mentions.members.size == 1) {
                            member = message.mentions.members.first();
                        }
                        let classToFind = itemsjson["classlist"].find(currentclassname => currentclassname == split[1]);
                        if (classToFind) {
                            let name = split[0];
                            let ap = parseInt(split[2]);
                            let aap = parseInt(split[3]);
                            let dp = parseInt(split[4]);
                            if (Number.isInteger(ap) && ap >= 0 && ap < 400 && Number.isInteger(aap) && aap >= 0 && aap < 400 && Number.isInteger(dp) && dp >= 0 && dp < 600) {
                                let player = new Player(member, classToFind, ap, aap, dp, false);
                                if (!member) {
                                    player.name = name;
                                }
                                players = await addPlayer(players, player, message.author);
                            } else {
                                interactions.wSendAuthor(message.author, "Some stats are way too high, check again.");
                            }
                        } else {
                            interactions.wSendAuthor(message.author, enteredCommand.split(" ")[0] + " class not found.\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
                        }
                    } else {
                        interactions.wSendAuthor(message.author, "Incorrect format. Correct format is `[name] [classname] [ap] [aap] [dp]`\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
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
                        let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                        let split = args.split(" ");
                        if (split.length == 3) {
                            let ap = parseInt(split[0]);
                            let aap = parseInt(split[1]);
                            let dp = parseInt(split[2]);
                            if (Number.isInteger(ap) && ap >= 0 && ap < 400 && Number.isInteger(aap) && aap >= 0 && aap < 400 && Number.isInteger(dp) && dp >= 0 && dp < 600) {
                                let player = new Player(message.member, classToFind, ap, aap, dp, false);
                                players = await addPlayer(players, player, message.author);
                            } else {
                                interactions.wSendAuthor(message.author, "Some stats are too high or not numbers.");
                            }
                        } else if (!args) {
                            let player = new Player(message.member, classToFind, null, null, null, true);
                            players = await addPlayer(players, player, message.author);
                        } else {
                            interactions.wSendAuthor(message.author, "Incorrect format. Correct format is `[classname] [ap] [aap] [dp]` or `[classname]`\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
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
                    let player;
                    if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
                        player = new Player(message.mentions.members.first());
                    } else {
                        player = new Player();
                        player.name = args;
                    }
                    let playersFound = players.filter(currentPlayer => currentPlayer.equals(player));
                    if (playersFound.length > 0) {
                        interactions.wSendChannel(message.channel, displayFullPlayer(playersFound[0]));
                    } else {
                        interactions.wSendChannel(message.channel, "Couldn't find this player.");
                    }
                } else if (enteredCommand == commands["stats"] && checkIntPermission(message)) {
                    let split = args.split(" ");
                    //split.length cannot be 0 here
                    if (split.length <= 2) {
                        if (split.length == 1) {
                            if (itemsjson["classlist"].includes(args) || !args) {
                                message.react("✅");
                                interactions.wSendChannel(message.channel, getStatsEmbed(players, args));
                            } else {
                                let day;
                                if (args == "today") {
                                    let today = new Date();
                                    day = today.getDay();
                                } else if (util.findCorrespondingDayNumber(args) != null) {
                                    day = util.findCorrespondingDayNumber(args);
                                }
                                if (day != null) {
                                    message.react("✅");
                                    let playersGear = await getSignedUpPlayersGears(day, players);
                                    if (playersGear) {
                                        interactions.wSendChannel(message.channel, getSignedUpStatsEmbed(playersGear, args, day));
                                    } else {
                                        interactions.wSendChannel(message.channel, "No message found for " + util.findCorrespondingDayName(day));
                                    }
                                }
                            }
                        } else {
                            let className = itemsjson["classlist"].includes(split[0]) ? split[0] : (itemsjson["classlist"].includes(split[1]) ? split[1] : null);
                            let today = new Date();
                            let possibleDay0 = split[0] == "today" ? today.getDay() : util.findCorrespondingDayNumber(split[0]);
                            let possibleDay1 = split[1] == "today" ? today.getDay() : util.findCorrespondingDayNumber(split[1]);
                            let day = possibleDay0 ? possibleDay0 : (possibleDay1 ? possibleDay1 : null);
                            message.react("✅");
                            if (day != null && className != null) {
                                let playersGear = await getSignedUpPlayersGears(day, players);
                                if (playersGear) {
                                    interactions.wSendChannel(message.channel, getSignedUpStatsEmbed(playersGear, className, day));
                                } else {
                                    interactions.wSendChannel(message.channel, "No message found for " + util.findCorrespondingDayName(day));
                                }
                            } else {
                                interactions.wSendChannel(message.channel, "Incorrect request");
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

function getSignedUpStatsEmbed(players, classname, day) {
    if (itemsjson["classlist"].includes(classname)) {
        players = players.filter(currentPlayer => currentPlayer.classname == classname);
    } else {
        classname = null;
    }
    const embed = new Discord.RichEmbed();
    let embedTitle = ":pencil: STATS on " + util.findCorrespondingDayName(day) + (classname ? " for " + classname.charAt(0).toUpperCase() + classname.slice(1) : "");
    let embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);

    let playersWithoutHidden = players.filter(currentPlayer => !currentPlayer.hidden);
    if (playersWithoutHidden.length > 0) {
        embed.setDescription("Total players : " + playersWithoutHidden.length + " " + (playersWithoutHidden.length == players.length ? "" : (" (" + players.length + ")")));
        let avgAP = avg(playersWithoutHidden, player => {
            return player.ap;
        });
        let avgAAP = avg(playersWithoutHidden, player => {
            return player.aap;
        });
        let avgDP = avg(playersWithoutHidden, player => {
            return player.dp;
        });
        if (!classname) {
            let classes = [];
            itemsjson["classlist"].forEach(currentClass => {
                classes.push({ "className": currentClass, "count": countClassNames(players, currentClass) });
            });
            classes.sort((a, b) => {
                return b["count"] - a["count"];
            });
            let classText = "";
            classes.forEach(currentClass => {
                classText += currentClass["count"] + "x " + classEmojis.find(emoji => emoji.name == currentClass["className"]) + " " + currentClass["className"].charAt(0).toUpperCase() + currentClass["className"].slice(1) + "\n";
            });
            embed.addField("Class list", classText, true);
        }
        embed.addField("Average gear", util.valueFormat(util.valueFormat(avgAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgAAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgDP + "", 10), 100), true);
    } else {
        embed.setDescription("Empty player list.");
    }
    return embed;
}

/**
 * 
 * @param {number} day 
 * @param {Player[]} players 
 * @returns the players if found, null if not
 */
async function getSignedUpPlayersGears(day, players) {
    let signUps = await getDaySignUp(day);
    if (signUps) {
        let presentPlayers = [];
        signUps.forEach(player => {
            if (player[util.findCorrespondingDayName(day)] == "yes") {
                for (let i = 0; i < players.length; i++) {
                    if (player.id == players[i].id) {
                        presentPlayers.push(players[i]);
                        break;
                    }
                }
            }
        });
        return presentPlayers;
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
    let dayStr = util.findCorrespondingDayName(day);
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
                    let name = (member.nickname ? member.nickname : member.user.username);
                    let object = { "name": name, "id": user.id, [dayStr]: "no" };
                    signUps.push(object);
                }
            }));
        }
        if (yesReaction) {
            let users = await yesReaction.fetchUsers();
            await Promise.all(users.map(async user => {
                if (!signUpsHasId(signUps, user.id)) {
                    let member = await myServer.fetchMember(await bot.fetchUser(user.id));
                    if (member.roles.find(x => x.name == "Members")) {
                        let name = (member.nickname ? member.nickname : member.user.username);
                        let object = { "name": name, "id": user.id, [dayStr]: "yes" };
                        signUps.push(object);
                    }
                }
            }));
        }
        myServer.members.forEach(member => {
            if (member.roles.find(x => x.name == "Members")) {
                if (!signUpsHasId(signUps, member.id) && member.id != bot.user.id) {
                    let name = (member.nickname ? member.nickname : member.user.username);
                    let object = { "name": name, "id": member.id, [dayStr]: "N/A" };
                    signUps.push(object);
                }
            }
        });
        return signUps;
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

/**
 * @param {number} day 
 */
async function saveSignUp(day) {
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
        let todayStr = Object.keys(signUps[0])[2];
        let signuppath = "./download/signups" + todayStr + ".csv";
        const csv = parse(signUps, { unwind: ["name", "id", todayStr] });
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
        if (element[dayStr] == "yes") {
            yesToSend += "<@" + element.id + ">" + "\n";
            yes++;
        }
    });

    let noToSend = "";
    let no = 0;
    signUps.forEach(element => {
        if (element[dayStr] == "no") {
            noToSend += "<@" + element.id + ">" + "\n";
            no++;
        }
    });

    let naToSend = "";
    let na = 0;
    signUps.forEach(element => {
        if (element[dayStr] == "N/A") {
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
 * @param {Player[]} players 
 * @param {Player} player 
 * @param {Discord.GuildMember} origin
 * @returns the player list with player removed
 */
async function removePlayer(players, player, origin) {
    let content = "";
    content += player.getNameOrMention() + " removed from gear list.";
    content += "\n(Command origin: " + origin + ")";
    await interactions.wSendChannel(myChangelog, content);
    players = players.filter(currentPlayer => !currentPlayer.equals(player));
    return players;
}

/**
 * remove and add (readd) a player to a player list
 * @param {Player[]} players 
 * @param {Player} player 
 * @param {Discord.GuildMember} origin
 * @returns the player list with player added
 */
async function addPlayer(players, player, origin) {
    let oldPlayer = players.filter(currentPlayer => currentPlayer.equals(player))[0];
    let content = "";
    content += player.getNameOrMention() + "** gear update**\n> Old: " + (oldPlayer ? displayFullPlayer(oldPlayer) : "N/A") + "\n> New: " + displayFullPlayer(player);
    content += "\n(Command origin: " + origin + ")";
    await interactions.wSendChannel(myChangelog, content);
    players = players.filter(currentPlayer => !currentPlayer.equals(player));
    players.push(player);
    return players;
}

async function savePlayers() {
    let playerspath = "./download/players.json";
    await files.writeObjectToFile(playerspath, players);
    await files.uploadFileToChannel(playerspath, myGearData, configjson["gearDataMessage"]);
}

/**
 * @param {Player} player 
 * @returns a string containing the server class emoji and the player display
 */
function displayFullPlayer(player) {
    return classEmojis.find(emoji => emoji.name == player.classname) + " " + player;
}

/**
 * if the bot message exists, edits it
 * if not, sends a new one
 * @param {Discord.Message} channel the channel where the original message comes from
 * @param {Object} botMsg the bot message
 * @param {Player[]} players
 * @returns the new message
 */
async function refreshBotMsg(channel, botMsg, players) {
    if (!botMsg.reference) {
        //no bot message to begin with, create a new one
        botMsg.reference = await newBotMessage(channel, getPlayersEmbed(players));
    } else {
        if (!await interactions.wEditMsg(botMsg.reference, getPlayersEmbed(players))) {
            //message probably got deleted or something, either way creating a new one
            logger.log("INFO: Couldn't find the existing bot message to edit, creating a new one");
            botMsg.reference = await newBotMessage(channel, getPlayersEmbed(players));
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

function getStatsEmbed(players, classname) {
    if (classname) {
        players = players.filter(currentPlayer => currentPlayer.classname == classname);
    }
    const embed = new Discord.RichEmbed();
    let embedTitle = ":pencil: STATS" + (classname ? " for " + classname.charAt(0).toUpperCase() + classname.slice(1) : "");
    let embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);

    let playersWithoutHidden = players.filter(currentPlayer => !currentPlayer.hidden);
    if (playersWithoutHidden.length > 0) {
        let minAP = compare(playersWithoutHidden, (min, player) => {
            return min.getRealAP() > player.getRealAP();
        });
        let minDP = compare(playersWithoutHidden, (min, player) => {
            return min.dp > player.dp;
        });
        let minGS = compare(playersWithoutHidden, (min, player) => {
            return min.getGS() > player.getGS();
        });
        let maxAP = compare(playersWithoutHidden, (max, player) => {
            return max.getRealAP() < player.getRealAP();
        });
        let maxDP = compare(playersWithoutHidden, (max, player) => {
            return max.dp < player.dp;
        });
        let maxGS = compare(playersWithoutHidden, (max, player) => {
            return max.getGS() < player.getGS();
        });
        let avgAP = avg(playersWithoutHidden, player => {
            return player.ap;
        });
        let avgAAP = avg(playersWithoutHidden, player => {
            return player.aap;
        });
        let avgDP = avg(playersWithoutHidden, player => {
            return player.dp;
        });
        if (!classname) {
            let minClass = compare(itemsjson["classlist"], (min, class2) => {
                return countClassNames(players, min) > countClassNames(players, class2);
            });
            let maxClass = compare(itemsjson["classlist"], (max, class2) => {
                return countClassNames(players, max) < countClassNames(players, class2);
            });
            embed.addField("Most played",
                classEmojis.find(emoji => emoji.name == maxClass) + " " + maxClass.charAt(0).toUpperCase() + maxClass.slice(1) + " (" + countClassNames(players, maxClass) + ")",
                true);
            embed.addField("Least played",
                classEmojis.find(emoji => emoji.name == minClass) + " " + minClass.charAt(0).toUpperCase() + minClass.slice(1) + " (" + countClassNames(players, minClass) + ")",
                true);
        }
        embed.addField("Average gear : ", util.valueFormat(util.valueFormat(avgAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgAAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgDP + "", 10), 100), true);
        embed.addField("Highest GS : " + maxGS.getGS(), displayFullPlayer(maxGS), true);
        embed.addField("Highest AP : " + maxAP.getRealAP(), displayFullPlayer(maxAP), true);
        embed.addField("Highest DP : " + maxDP.dp, displayFullPlayer(maxDP), true);
        embed.addField("Lowest GS : " + minGS.getGS(), displayFullPlayer(minGS), true);
        embed.addField("Lowest AP : " + minAP.getRealAP(), displayFullPlayer(minAP), true);
        embed.addField("Lowest DP : " + minDP.dp, displayFullPlayer(minDP), true);
    } else {
        embed.setDescription("Empty player list.");
    }
    return embed;
}

function getPlayersEmbed(players) {
    const embed = new Discord.RichEmbed();
    let embedTitle = ":star: PLAYERS (" + players.length + ")";
    let embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);
    if (players.length > 0) {
        itemsjson["classlist"].forEach(classname => {
            let classcount = countClassNames(players, classname);
            if (classcount > 0) {
                let fieldContent = "";
                let fieldTitle = classname.charAt(0).toUpperCase() + classname.slice(1) + " (" + classcount + ")\n";
                players.forEach(player => {
                    if (player.classname == classname) {
                        fieldContent += displayFullPlayer(player) + "\n";
                    }
                });
                embed.addField("" + fieldTitle, fieldContent, true);
            }
        });
    } else {
        embed.setDescription("Player list is empty :(");
    }
    return embed;
}

/**
 * @param {Player[]} players 
 * @param {string} classname 
 * @returns the number of players that have this classname
 */
function countClassNames(players, classname) {
    let res = 0;
    for (let i = 0; i < players.length; i++) {
        let player = players[i];
        if (player.classname == classname) {
            res++;
        }
    }
    return res;
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
 * @param {any[]} list 
 * @param {function} comparator 
 * @returns the result of the function applied to all players in the list
 */
function compare(list, comparator) {
    let res = list[0];
    list.forEach(element => {
        //min : min > element
        //max : max < element
        if (comparator(res, element)) {
            res = element;
        }
    });
    return res;
}

/**
 * @param {any[]} list 
 * @param {function} aggregate 
 */
function avg(list, aggregate) {
    let res = 0;
    list.forEach(element => {
        res += aggregate(element);
    });
    return Math.round(res / list.length);
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
 * @param {string} name his display name (if doesn't have id)
 * @param {string} classname
 * @param {string} ap
 * @param {string} aap
 * @param {string} dp
 * @param {boolean} hidden
 * @returns a player object with the given data
 */
async function revivePlayer(id, name, classname, ap, aap, dp, hidden) {
    if (id) {
        return new Player(await myServer.fetchMember(await bot.fetchUser(id)), classname, ap, aap, dp, hidden);
    } else {
        let player = new Player(null, classname, ap, aap, dp, hidden);
        player.name = name;
        return player;
    }
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
    var players = [];
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
                players.push(await revivePlayer(currentPlayer["id"], currentPlayer["name"], currentPlayer["classname"], currentPlayer["ap"], currentPlayer["aap"], currentPlayer["dp"], currentPlayer["hidden"]));
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
