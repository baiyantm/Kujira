const Discord = require("discord.js");
const files = require("./modules/files");
const interactions = require("./modules/interactions");
const logger = require("./modules/logger");
const util = require("./modules/util");

async function initLookout() {
    logger.log("INFO: Initializing lookout ...");

    bot.on("message", async message => onMessageHandler(message));

    let statusDelay = 10000;
    //changes "game status" of the bot every statusDelay ms
    setInterval(async () => {
        try {
            await bot.user.setPresence({
                game:
                {
                    name: "animu",
                    type: "WATCHING"
                }
            });
        } catch (e) {
            logger.logError("Game status error", e);
        }
    }, statusDelay);

    logger.log("INFO: ... lookout initialization done");
}

async function onMessageHandler(message) {
    let enteredCommand = message.content.toLowerCase();
    if (message.channel.id == myGate.id) {
        try {
            if (message.author.bot) return; //bot ignores bots
            if (enteredCommand == "ok") {
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
        } catch (e) {
            logger.logError("On message listener error. Something really bad went wrong", e);
        }
        //delete entered commands
        setTimeout(async () => {
            await interactions.wDelete(message);
        }, configjson["deleteDelay"]);
    }
}

// ------ bot general behavior ------
const bot = new Discord.Client();
var configjson = files.openJsonFile("./resources/config.json", "utf8");
configjson = process.env.TOKEN ? configjson["kuji"] : configjson["dev"];
var itemsjson = files.openJsonFile("./resources/items.json", "utf8");
var init = false;

if (configjson && itemsjson) {
    // Initialize Discord Bot
    var token = process.env.TOKEN ? process.env.TOKEN : configjson["token"];
    bot.login(token);

    var myServer;
    var myGate;
    var loading = 1000;

    bot.once("ready", async () => {
        logger.log("INFO: Logged in as " + bot.user.tag);
        bot.user.setPresence({ game: { name: "booting up..." } });

        myServer = bot.guilds.get(configjson["botServerID"]);
        myGate = bot.channels.get(configjson["gateID"]);

        logger.log("INFO: Starting in " + loading + "ms");
        var interval = setInterval(async () => {
            myServer = bot.guilds.get(configjson["botServerID"]);
            myGate = bot.channels.get(configjson["gateID"]);

            logger.log("INFO: Booting up attempt...");
            if (myServer && myGate) {
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
