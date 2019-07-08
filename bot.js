// @ts-check

const { parse } = require('json2csv');
const Discord = require("discord.js");
const files = require("./modules/files");
const interactions = require("./modules/interactions");
const logger = require("./modules/logger");
const util = require("./modules/util");
var Player = require('./classes/Player');

async function initLookout() {
    logger.log("INFO: Initializing lookout ...");

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
    bot.on("message", async message => onMessageHandler(message, botMsg));
    bot.on("messageReactionAdd", async messageReaction => onReactionHandler(messageReaction));

    bot.on('raw', packet => {
        // We don't want this to run on unrelated packets
        if (!['MESSAGE_REACTION_ADD'].includes(packet.t)) return;
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
            if (packet.t === 'MESSAGE_REACTION_ADD') {
                bot.emit('messageReactionAdd', reaction, bot.users.get(packet.d.user_id));
            }
        });
    });

    bot.user.setPresence({ game: { name: "a successful bootup !" } });
    let statusDelay = 300000;
    //changes "game status" of the bot every statusDelay ms
    bot.setInterval(async () => {
        try {
            await bot.user.setPresence({
                game:
                {
                    name: players.length > 0 ? players[Math.floor(Math.random() * players.length)].name : "an empty player list :(",
                    type: "WATCHING"
                }
            });
        } catch (e) {
            logger.logError("Game status error", e);
        }
    }, statusDelay);

    bot.setInterval(async () => {
        savePlayers();
    }, configjson["saveDelay"]);

    setupSignUpSchedule();

    process.on('SIGTERM', function () {
        logger.log("Recieved signal to terminate, saving and shutting down");
        savePlayers();
        bot.destroy();
        process.exit(0);
    });

    logger.log("INFO: ... lookout initialization done");
}

/**
 * listener for emoji add event
 * @param {Discord.MessageReaction} messageReaction 
 */
async function onReactionHandler(messageReaction) {
    if (messageReaction.message.channel.id == mySignUp.id) {
        let message = messageReaction.message;
        let yesReaction = message.reactions.filter(messageReaction => messageReaction.emoji.name == itemsjson["yesreaction"]).first();
        let noReaction = message.reactions.filter(messageReaction => messageReaction.emoji.name == itemsjson["noreaction"]).first();
        if (messageReaction.emoji.name == itemsjson["noreaction"]) {
            let user = noReaction.users.last();
            if (user.id != bot.user.id && yesReaction && (await noReaction.fetchUsers()).get(user.id)) {
                yesReaction.remove(user);
            }
        }
        if (messageReaction.emoji.name == itemsjson["yesreaction"]) {
            let user = yesReaction.users.last();
            if (user.id != bot.user.id && noReaction && (await yesReaction.fetchUsers()).get(user.id)) {
                noReaction.remove(user);
            }
        }
    }
}

/**
 * listener for message event
 * @param {Discord.Message} message the message sent
 * @param {Object} botMsg reference to the bot message
 */
async function onMessageHandler(message, botMsg) {
    //if (message.author.bot) return; //bot ignores bots
    var commands;
    let enteredCommand = message.content.toLowerCase();
    try {
        if (message.channel.id == myGate.id) {
            // ---------- GATE ----------
            commands = itemsjson["commands"]["gate"]["guest"];
            if (enteredCommand == commands["ok"]) {
                let publicRole = message.guild.roles.find(x => x.name == "Public");
                if (!message.member.roles.has(publicRole.id)) {
                    try {
                        await message.member.addRole(publicRole);
                        logger.log("ROLE: " + publicRole + " role added to " + message.author.tag);
                    } catch (e) {
                        interactions.wSendAuthor(message.author, "Public role not found or not self-assignable, please contact an admin.");
                    }
                }
            }
            await deleteCommand(message);
        } else if (message.channel.id == mySignUp.id) {
            // ---------- SIGNUP ----------
            if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
                commands = itemsjson["commands"]["signup"]["adv"];
                enteredCommand = enteredCommand.substr(1);
                if (enteredCommand == commands["clear"]) {
                    await clearChannel(message.channel);
                } if (enteredCommand == commands["reset"]) {
                    await clearChannel(message.channel);
                    await bulkSignUpMessages();
                } else if (enteredCommand == commands["dump"]) {
                    //manually dumps data into data channel
                    await saveSignUp();
                    await deleteCommand(message);
                } else if (enteredCommand == commands["bulk"]) {
                    await bulkSignUpMessages();
                    await deleteCommand(message);
                }
            }
        } else if (message.channel.id == myGear.id) {
            // ---------- GEAR ----------
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
                        players = players.filter(currentPlayer => !currentPlayer.equals(player));
                    } else {
                        let player = new Player();
                        player.name = args;
                        players = players.filter(currentPlayer => !currentPlayer.equals(player));
                    }
                } else if (enteredCommand == commands["add"]) {
                    let split = args.split(" ");
                    if (split.length == 5) {
                        let member = null;
                        if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
                            member = message.mentions.members.first();
                        }
                        let classToFind = itemsjson["classlist"].find(currentclassname => currentclassname == split[1]);
                        if (classToFind) {
                            let name = split[0];
                            let ap = parseInt(split[2]);
                            let aap = parseInt(split[3]);
                            let dp = parseInt(split[4]);
                            if (Number.isInteger(ap) && ap >= 0 && ap < 400 && Number.isInteger(aap) && aap >= 0 && aap < 400 && Number.isInteger(dp) && dp >= 0 && dp < 600) {
                                let player = new Player(member, classToFind, ap, aap, dp);
                                if (!member) {
                                    player.name = name;
                                }
                                players = players.filter(currentPlayer => !currentPlayer.equals(player));
                                players.push(player);
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
                let classToFind = itemsjson["classlist"].find(currentclassname => currentclassname == enteredCommand.split(" ")[0]);
                if (classToFind) {
                    let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                    let split = args.split(" ");
                    if (split.length == 3) {
                        let ap = parseInt(split[0]);
                        let aap = parseInt(split[1]);
                        let dp = parseInt(split[2]);
                        if (Number.isInteger(ap) && ap >= 0 && ap < 400 && Number.isInteger(aap) && aap >= 0 && aap < 400 && Number.isInteger(dp) && dp >= 0 && dp < 600) {
                            let player = new Player(message.member, classToFind, ap, aap, dp);
                            players = players.filter(currentPlayer => !currentPlayer.equals(player));
                            players.push(player);
                        } else {
                            interactions.wSendAuthor(message.author, "Some stats are way too high, cheater !");
                        }
                    } else {
                        interactions.wSendAuthor(message.author, "Incorrect format. Correct format is `[classname] [ap] [aap] [dp]`\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
                    }
                } else {
                    interactions.wSendAuthor(message.author, enteredCommand.split(" ")[0] + " class not found.\n\nClass list :\n```" + itemsjson["classlist"].join("\n") + "```");
                }
            }
            await deleteCommand(message);

            //refresh bot message
            bot.setTimeout(async () => {
                await refreshBotMsg(myGear, botMsg, players);
            }, configjson["refreshDelay"]);
        } else {
            // ---------- ALL CHANNELS ----------
            if (enteredCommand.startsWith("?") && checkIntPermission(message)) {
                commands = itemsjson["commands"]["any"]["guest"];
                enteredCommand = enteredCommand.substr(1);
                let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
                if (enteredCommand == commands["gear"]) {
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
                } else if (enteredCommand == commands["stats"]) {
                    if (itemsjson["classlist"].includes(args)) {
                        message.react("✅");
                        interactions.wSendChannel(message.channel, getStatsEmbed(players, args));
                    } else if (!args) {
                        message.react("✅");
                        interactions.wSendChannel(message.channel, getStatsEmbed(players));
                    }
                }
            }
        }
    } catch (e) {
        logger.logError("On message listener error. Something really bad went wrong", e);
    }
}

/**
 * generate 7d worth of signups from today (inc today)
 */
async function bulkSignUpMessages() {
    let today = new Date();
    let iDay = 0;
    for (let i = today.getDay(); i < 7; i++) {
        let date = new Date();
        date.setDate(date.getDate() + iDay); // get the next day
        iDay++;
        let content = util.findCorrespondingDayName(i) + " - " + util.zeroString(date.getDate()) + "." + util.zeroString(date.getMonth()) + "." + date.getFullYear();
        let message = await interactions.wSendChannel(mySignUp, content);
        await message.react(await fetchEmoji(itemsjson["yesreaction"]));
        await message.react(await fetchEmoji(itemsjson["noreaction"]));
    }
}

/**
 * setup timeouts to save everyday at X hour; when one is done the next one is set
 */
function setupSignUpSchedule() {
    let today = new Date();
    let minUntilSave = util.getMinUntil(today.getDay() + Number(util.isNextDay(configjson["hourSignup"])), configjson["hourSignup"], 0);
    bot.setTimeout(async () => {
        await saveSignUp();

        //setup in the next one
        let today = new Date();
        let minUntilSave = util.getMinUntil(today.getDay() + Number(util.isNextDay(configjson["hourSignup"])), configjson["hourSignup"], 0);
        bot.setTimeout(async () => {
            await saveSignUp();
        }, minUntilSave * 60 * 1000);
    }, minUntilSave * 60 * 1000);
    logger.log("INFO: Sign ups save schedule set");
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

/*
--------------------------------------- SIGNUP ---------------------------------------
*/

/**
 * gets a signup object from the message
 * @param {Date} day 
 * @returns
 */
async function getDaySignUp(day) {
    let dayStr = util.findCorrespondingDayName(day.getDay());
    let signUps = [];
    //let signUps = { "name": [], "id": [], [dayStr]: [] };
    let reactionMessage = await getDaySignUpMessage(day, mySignUp);
    if (reactionMessage) {
        let yesReaction = reactionMessage.reactions.filter(reaction => reaction.emoji.name == itemsjson["yesreaction"]).first();
        let noReaction = reactionMessage.reactions.filter(reaction => reaction.emoji.name == itemsjson["noreaction"]).first();
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
 * @param {Date} date 
 * @param {Discord.TextChannel} channel 
 * @returns the message containing the day, null if none
 */
async function getDaySignUpMessage(date, channel) {
    let message;
    let dateName = util.findCorrespondingDayName(date.getDay()).toLowerCase();
    await channel.fetchMessages({ limit: 100 }).then(async messages => {
        message = await messages.find(message => message.content.toLowerCase().startsWith(dateName));
    });
    return message;
}

async function saveSignUp() {
    let signUps = await getDaySignUp(new Date());
    if (signUps) {
        signUps.sort((a, b) => {
            return a.id - b.id;
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
        interactions.wSendChannel(mySignUpData, "No message found for today.");
    }
}

async function getSignUpsEmbed(signUps) {
    let dayStr = Object.keys(signUps[0])[2];
    const embed = new Discord.RichEmbed();
    var embedTitle = ":bookmark_tabs: SIGN UPS";
    var embedColor = 3447003;
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
        embed.addField(await fetchEmoji(itemsjson["yesreaction"]) + " YES (" + yes + ")", yesToSend, true);
    }
    if (noToSend) {
        embed.addField(await fetchEmoji(itemsjson["noreaction"]) + " NO (" + no + ")", noToSend, true);
    }
    if (naToSend) {
        embed.addField(":question:" + " N/A (" + na + ")", naToSend, true);
    }
    embed.setTimestamp()
    return embed;
}

/*
--------------------------------------- GEAR ---------------------------------------
*/

function savePlayers() {
    let playerspath = "./download/players.json";
    files.writeObjectToFile(playerspath, players);
    files.uploadFileToChannel(playerspath, myGearData, configjson["gearDataMessage"]);
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
    var sentMessage;
    sentMessage = await interactions.wSendChannel(channel, content);
    return sentMessage;
}

/**
 * deletes all messages in the channel
 * @param {Discord.TextChannel|Discord.DMChannel|Discord.GroupDMChannel} channel the channel to clean
 */
async function clearChannel(channel) {
    var deleteCount = 100;
    var moreMessages = true;
    bot.setTimeout(() => {
        moreMessages = false;
    }, 2500);
    while (moreMessages) {
        try {
            channel.bulkDelete(deleteCount, true);
            logger.log("INFO: Deleted " + deleteCount + " messages in " + channel);
            moreMessages = false;
            //lookup for more messages
            await channel.fetchMessages({ limit: 1 }).then(messages => {
                messages.forEach(() => {
                    //atleast one message found = channel not cleared => delete more
                    moreMessages = true;
                });
            });
        } catch (e) {
            logger.logError("bulkDelete error", e);
            moreMessages = false;
        }
    }
}

function getStatsEmbed(players, classname) {
    if (classname) {
        players = players.filter(currentPlayer => currentPlayer.classname == classname);
    }
    const embed = new Discord.RichEmbed();
    var embedTitle = ":pencil: STATS" + (classname ? " for " + classname.charAt(0).toUpperCase() + classname.slice(1) : "");
    var embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);
    if (players.length > 0) {

        let minAP = compare(players, (min, player) => {
            return min.getRealAP() > player.getRealAP();
        });
        let minDP = compare(players, (min, player) => {
            return min.dp > player.dp;
        });
        let minGS = compare(players, (min, player) => {
            return min.getGS() > player.getGS();
        });
        let maxAP = compare(players, (max, player) => {
            return max.getRealAP() < player.getRealAP();
        });
        let maxDP = compare(players, (max, player) => {
            return max.dp < player.dp;
        });
        let maxGS = compare(players, (max, player) => {
            return max.getGS() < player.getGS();
        });
        let avgAP = avg(players, player => {
            return player.ap;
        });
        let avgAAP = avg(players, player => {
            return player.aap;
        });
        let avgDP = avg(players, player => {
            return player.dp;
        });
        if (!classname) {
            let minClass = compare(itemsjson["classlist"], (min, class2) => {
                return countClassNames(players, min) > countClassNames(players, class2);
            });
            let maxClass = compare(itemsjson["classlist"], (max, class2) => {
                return countClassNames(players, max) < countClassNames(players, class2);
            });
            embed.addField("Most played class :",
                classEmojis.find(emoji => emoji.name == maxClass) + " " + maxClass.charAt(0).toUpperCase() + maxClass.slice(1) + " (" + countClassNames(players, maxClass) + ")",
                true);
            embed.addField("Least played class :",
                classEmojis.find(emoji => emoji.name == minClass) + " " + minClass.charAt(0).toUpperCase() + minClass.slice(1) + " (" + countClassNames(players, minClass) + ")",
                true);
        }
        embed.addField("Average gear :", avgAP + " / " + avgAAP + " / " + avgDP, false);
        embed.addField("Highest GS : " + maxGS.getGS(), displayFullPlayer(maxGS), true);
        embed.addField("Highest AP : " + maxAP.getRealAP(), displayFullPlayer(maxAP), true);
        embed.addField("Highest DP : " + maxDP.dp, displayFullPlayer(maxDP), true);
        embed.addField("Lowest GS : " + minGS.getGS(), displayFullPlayer(minGS), true);
        embed.addField("Lowest AP : " + minAP.getRealAP(), displayFullPlayer(minAP), true);
        embed.addField("Lowest DP : " + minDP.dp, displayFullPlayer(minDP), true);
    } else {
        embed.setDescription("There are no " + classname.charAt(0).toUpperCase() + classname.slice(1) + " :(");
    }
    return embed;
}

function getPlayersEmbed(players) {
    const embed = new Discord.RichEmbed();
    var embedTitle = ":star: PLAYERS";
    var embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);
    if (players.length > 0) {
        itemsjson["classlist"].forEach(classname => {
            let classcount = countClassNames(players, classname);
            if (classcount > 0) {
                let fieldContent = "";
                let fieldTitle = classname.charAt(0).toUpperCase() + classname.slice(1) + " (" + classcount + ") :\n";
                players.forEach(player => {
                    if (player.classname == classname) {
                        fieldContent += displayFullPlayer(player) + "\n";
                    }
                });
                embed.addField(fieldTitle, fieldContent, true);
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

/**
 * delete a command message
 * @param {Discord.Message} message 
 */
async function deleteCommand(message) {
    if (!message.content.startsWith("! ") || (message.content.startsWith("! ") && !await checkAdvPermission(message))) {
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
async function checkIntPermission(message) {
    var allowed = false;
    if (message.member.roles.find(x => x.name == "Members")) {
        allowed = true;
    } else {
        await interactions.wSendAuthor(message.author, 'Insufficient permissions.');
    }
    return allowed;
}

/**
 * whether the user has adv user permissions
 * @param {Discord.Message} message the original message
 * @returns true if user is allowed, false if not
 */
async function checkAdvPermission(message) {
    var allowed = false;
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
 * @returns a player object with the given data
 */
async function revivePlayer(id, name, classname, ap, aap, dp) {
    if (id) {
        return new Player(await myServer.fetchMember(await bot.fetchUser(id)), classname, ap, aap, dp);
    } else {
        let player = new Player(null, classname, ap, aap, dp);
        player.name = name;
        return player;
    }
}

/**
 * downloads a file attached to the last message of the channel and put it in download/
 * @param {string} filename the file's name
 * @param {Discord.TextChannel} channel the channel to download from
 */
async function downloadFileFromChannel(filename, channel) {
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
            myServer.emojis.find(emoji => {
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
var configjson = files.openJsonFile("./resources/config.json", "utf8");
configjson = process.env.TOKEN ? configjson["kuji"] : configjson["dev"];
var itemsjson = files.openJsonFile("./resources/items.json", "utf8");
var init = false;

if (configjson && itemsjson) {
    // Initialize Discord Bot
    var token = process.env.TOKEN ? process.env.TOKEN : configjson["token"];
    bot.login(token);

    //more globals
    var myServer;
    var myGate;
    var myGear;
    var myGearData;
    var mySignUp;
    var mySignUpData;
    var players = [];
    var classEmojis = [];
    var loading = 1000;

    bot.once("ready", async () => {
        logger.log("INFO: Logged in as " + bot.user.tag);
        bot.user.setPresence({ game: { name: "booting up..." } });

        myServer = bot.guilds.get(configjson["botServerID"]);
        myGearData = bot.channels.get(configjson["gearDataID"]);

        itemsjson["classlist"].forEach(async classname => {
            classEmojis.push(await fetchEmoji(classname));
        });

        //attempt to load a previously saved state
        try {
            // @ts-ignore
            await downloadFileFromChannel("players.json", myGearData);
        } catch (e) {
            logger.log("INFO: Couldn't find or download the players file");
        }
        var playersjson = files.openJsonFile("./download/players.json", "utf8");
        if (playersjson) {
            playersjson.forEach(async currentPlayer => {
                players.push(await revivePlayer(currentPlayer["id"], currentPlayer["name"], currentPlayer["classname"], currentPlayer["ap"], currentPlayer["aap"], currentPlayer["dp"]));
            });
        }

        logger.log("INFO: Starting in " + loading + "ms");
        var interval = setInterval(async () => {
            myServer = bot.guilds.get(configjson["botServerID"]);
            myGate = bot.channels.get(configjson["gateID"]);
            myGear = bot.channels.get(configjson["gearID"]);
            myGearData = bot.channels.get(configjson["gearDataID"]);
            mySignUp = bot.channels.get(configjson["signUpID"]);
            mySignUpData = bot.channels.get(configjson["signUpDataID"]);

            logger.log("INFO: Booting up attempt...");
            if (myServer && myGate && myGear && myGearData && classEmojis && mySignUp && mySignUpData) {
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
