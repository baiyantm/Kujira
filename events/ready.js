const log = require('log4js').getLogger('events/ready');
const fetch = require('node-fetch');

const { cacheReactions } = require('../utils/cache');
const { downloadFilesFromMessage } = require('../utils/files');

const { geardata, Guilds } = require('../constants');

const CacheChannels = [
    Guilds.Remedy.announcements,
    Guilds.Alliance.announcements, 
    Guilds.Trial.trialreactionID 
];
const msgChannels = [
    Guilds.Remedy.gear,
    Guilds.Alliance.gear
];

var init = false;

module.exports = {
    name: 'ready',
    once: true,
    async execute(client, ss) {
        log.info('ON READY');
        log.mark(`Ready Event fired. Logged in as ${client.user.tag}.`);
        await client.user.setPresence({ activity: { name: 'Startup Stage 1/2' } });

        // caches

        log.debug('Checking server caches...');
        client.servers.forEach(async (server, id) => {
            if(!client.guilds.cache.get(server.id)) {
                log.trace(`fetching ${server}`);
                if(!await client.guilds.fetch(server.id).available) {
                    log.warn(`Failed to fetch server! ${server}`);
                }
            } else {   
                log.trace(`${server.name}: ok!`);             
            }
        }); 

        // geardata

        log.debug('Loading geardata...');
        let geardataChannel = await client.channels.fetch(geardata);
        let playerjson = await getStoredPlayerData(geardataChannel);


        log.info('Post Ready Event initialization completed.');

        if (!init) {
            init = true;
            log.mark('init Lookout')
            await initLookout(client);
            log.mark('post Lookout')
        } else {
            // hmmm...
            log.info('Repeated on_ready event triggered.');
        }
    },
};

async function initLookout(client) {
    client.user.setPresence({ activity: { name: 'Startup Stage 2/2' } });
    for (chi of CacheChannels) {
        let ch = await client.channels.fetch(chi)
        await cacheReactions(client, ch);
    }

    await client.cacheAnnouncements();

    log.debug(`annCache entries: ${client.annCache.length}`);
    client.annCache.forEach(async msg => {
        try {
            log.trace(`try dl from ${msg.id}`);
            await downloadFilesFromMessage(msg);
        } catch (err) {
            log.error(err);
            // nothing to download
        }
    });

    log.debug(`Preparing to fetch botMessages`);
    for (chi of msgChannels) {
        log.trace(`chi: ${chi}`);
        let ch = await client.channels.fetch(chi);
        let messages = await client.fetchAllMessages(ch);
        let found = 0;
        log.trace(`count: ${messages.length}`);
        messages.forEach(msg => {
            if (msg.author.id == client.user.id) {
                if (!found) {
                    client.botMessages.set(chi, msg);
                    log.trace(`SET botMsg [${msg.channel.name} ${chi}] => ${msg.id}`);
                    found++;
                } else if (found == 1) {
                    client.botMessages.delete(chi);
                    log.info("Found multiple existing messages, aborting and generating a new one instead.");
                    found++;
                }
            }
        });
        if (!found) log.debug(`MISSING botMsg [${msg.channel.name} ${chi}]`);
        // await client.refreshBotMsg(ch, ); // TODO priority: high
    }
    log.trace('done');
}




async function initPlayers(client, server, channel) {
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
        log.info("Players file not found");
    }
}

// returns json or null
async function getStoredPlayerData(channel) {
    log.trace('fetching geardata...');

    let message;    
    try {
        let msgs = await channel.messages.fetch({ limit: 10 })
        message = msgs.first();
    } catch (e) {
        log.error(e);
        return;
    }

    if (message.content == 'geardata' && message.attachments) {
        log.trace('geardata msg ok');
        
        let att = message.attachments.first();
        if (att.url) {
            log.trace('geardata att.url ok');
            let j = fetch(att.url, { method: 'Get' })
                .then(res => res.json())
                .then((json) => {
                    return json;
                });
            if (j) {
                log.trace('geardata json ok');
                return j;
            } else log.warn('geardata json fail');
        } else log.warn('geardata att.url fail');
    } else log.warn('gardata msg fail');
    log.warn('geardata fail');
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
