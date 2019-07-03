// @ts-check

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

    bot.user.setPresence({ game: { name: "a successful bootup !" } });
    let statusDelay = 300000;
    //changes "game status" of the bot every statusDelay ms
    setInterval(async () => {
        try {
            await bot.user.setPresence({
                game:
                {
                    name: players.length > 0 ? players[Math.floor(Math.random()*players.length)].name : "an empty player list :(",
                    type: "WATCHING"
                }
            });
        } catch (e) {
            logger.logError("Game status error", e);
        }
    }, statusDelay);

    logger.log("INFO: ... lookout initialization done");
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
            commands = itemsjson["commands"]["guest"];
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
            deleteCommand(message, enteredCommand);
        } else if (message.channel.id == myGear.id) {
            // ---------- GEAR ----------
            if (enteredCommand.startsWith("?") && await checkAdvPermission(message)) {
                commands = itemsjson["commands"]["adv"];
                enteredCommand = enteredCommand.substr(1);
                let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                enteredCommand = enteredCommand.split(" ").splice(0, 1).join(" ");
                if (enteredCommand == commands["refresh"]) {
                } else if (enteredCommand == commands["clear"]) {
                    await clearChannel(message.channel);
                } else if (enteredCommand == commands["remove"]) {
                    if (message.mentions.members.size > 0 && message.mentions.members.size < 2) {
                        let player = new Player(message.mentions.members.first());
                        players = players.filter(currentPlayer => !currentPlayer.equals(player));
                        savePlayers();
                    } else {
                        let player = new Player();
                        player.name = args;
                        players = players.filter(currentPlayer => !currentPlayer.equals(player));
                        savePlayers();
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
                                    player.name = "[" + name + "]";
                                }
                                players = players.filter(currentPlayer => !currentPlayer.equals(player));
                                players.push(player);
                                savePlayers();
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
                            savePlayers();
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
            deleteCommand(message, enteredCommand);
            await refreshBotMsg(myGear, botMsg, players);
        } else {
            // ---------- ALL CHANNELS ----------
            if (enteredCommand.startsWith("?")) {
                commands = itemsjson["commands"]["guest"];
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
                        interactions.wSendChannel(message.channel, classEmojis[playersFound[0].classname] + playersFound[0]);
                    } else {
                        interactions.wSendChannel(message.channel, "Couldn't find this player.");
                    }
                }
            } else if(enteredCommand.startsWith("?stats")) {
                message.react("✅");
                let args = enteredCommand.split(" ").splice(1).join(" ").toLowerCase();
                if(!args) {

                } else {

                }
            }
        }
    } catch (e) {
        logger.logError("On message listener error. Something really bad went wrong", e);
    }
}

function savePlayers() {
    let playerspath = "./resources/players.json";
    files.writeObjectToFile(playerspath, players);
    files.uploadFileToChannel(playerspath, myGearData, configjson["gearDataMessage"]);
    cleanUpDataChannel();
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
    setTimeout(() => {
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

/**
 * if there's more than X messages, deletes the oldest ones (limit 10)
 */
function cleanUpDataChannel() {
    myGearData.fetchMessages({ limit: 10 }).then(async messages => {
        var count = 0;
        messages.forEach(async message => {
            if (count > 1) {
                try {
                    await message.delete();
                } catch (e) {
                    logger.log("INFO: Couldn't clean up gear data channel");
                }
            }
            count++;
        });
    });
}

function getPlayersEmbed(players) {
    const embed = new Discord.RichEmbed();
    var embedTitle = ":crossed_swords: PLAYER LIST :crossed_swords:";
    var embedColor = 3447003;
    embed.setColor(embedColor);
    embed.setTitle(embedTitle);
    if (players.length > 0) {
        itemsjson["classlist"].forEach(classname => {
            if (playerListHasClassname(players, classname)) {
                let fieldContent = "";
                let fieldTitle = "**" + classname.charAt(0).toUpperCase() + classname.slice(1) + " :**\n";
                players.forEach(player => {
                    if (player.classname == classname) {
                        fieldContent += classEmojis.find(emoji => emoji.name == classname) + " " + player + "\n";
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
 * @returns whether the list has this classname
 */
function playerListHasClassname(players, classname) {
    for (let i = 0; i < players.length; i++) {
        let player = players[i];
        if (player.classname == classname) {
            return true;
        }
    }
    return false;
}

/**
 * delete a command message
 * @param {Discord.Message} message 
 * @param {string} enteredCommand 
 */
async function deleteCommand(message, enteredCommand) {
    if (!enteredCommand.startsWith("! ") || (enteredCommand.startsWith("! ") && !await checkAdvPermission(message))) {
        setTimeout(async () => {
            await interactions.wDelete(message);
        }, configjson["deleteDelay"]);
    }
}

/**
 * whether the user has adv user permissions
 * @param {Discord.Message} message the original message
 * @returns true if user is allowed, false if not
 */
async function checkAdvPermission(message) {
    var allowed = false;
    if (message.member.roles.find(x => x.name === "Officers") || message.member.id == bot.user.id) {
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
 * downloads a file attached to the last message of the channel and put it in resources/
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
                                await files.download(element.url, "./resources/" + filename, () => { });
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
 * @param {string} classname 
 */
async function fetchClassEmoji(classname) {
    return new Promise((resolve, reject) => {
        try {
            myServer.emojis.find(emoji => {
                emoji.name == classname;
                resolve(emoji);
            });
        } catch (e) {
            reject(classname);
        }
        setTimeout(() => {
            reject(classname);
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
    var players = [];
    var classEmojis = [];
    var loading = 1000;

    bot.once("ready", async () => {
        logger.log("INFO: Logged in as " + bot.user.tag);
        bot.user.setPresence({ game: { name: "booting up..." } });

        myServer = bot.guilds.get(configjson["botServerID"]);
        myGate = bot.channels.get(configjson["gateID"]);
        myGear = bot.channels.get(configjson["gearID"]);
        myGearData = bot.channels.get(configjson["gearDataID"]);

        itemsjson["classlist"].forEach(async classname => {
            classEmojis.push(await fetchClassEmoji(classname));
        });

        //attempt to load a previously saved state
        try {
            await downloadFileFromChannel("players.json", myGearData);
        } catch (e) {
            logger.log("INFO: Couldn't find or download the players file");
        }
        var playersjson = files.openJsonFile("./resources/players.json", "utf8");
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

            logger.log("INFO: Booting up attempt...");
            if (myServer && myGate && myGear && myGearData && classEmojis) {
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
