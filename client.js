const log = require('log4js').getLogger('modules/client');

const Discord = require('discord.js');

const { readdirSync } = require('fs');

const PlayerCollection = require('./modules/playerCollection');
const Player = require('./modules/player');
const Server = require('./modules/server');

const { wEditMsg, wSendChannel } = require('./modules/interactions');
const { cacheReactions } = require('./utils/cache');
const { Guilds } = require('./constants');



module.exports = class Client extends Discord.Client {
    constructor(...args) {
        super(...args)

        this.botMessages = new Discord.Collection();
        this.commands = new Discord.Collection();
        this.events = new Discord.Collection();
        this.servers = new Discord.Collection();
        this.annCache = null;

        for (let [key, value] of Object.entries(Guilds)) {
            log.info(`Client init server ${key}`);
            this.servers.set(value.id, new Server(value));
        };

        this.players = new PlayerCollection();

        // Register Commands
        const commandFolders = readdirSync('./commands');
        for (const folder of commandFolders) {
            const commandFiles = readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(`./commands/${folder}/${file}`);
                this.commands.set(command.name, command);
            }
        }

        // Register EventHandlers
        const eventFiles = readdirSync('./events').filter(file => file.endsWith('.js'));
        for (const file of eventFiles) {
            const event = require(`./events/${file}`);
            if (event.once) {
                this.once(event.name, (...args) => event.execute(...args, this));
            } else {
                this.on(event.name, (...args) => event.execute(...args, this));
            }
        }
    }

    /**
     * Get Players
     * 
     * @param {?String} origin Optional Guild filter
     * @returns {PlayerCollection}
     */
    getPlayers(origin) {
        return origin ? this.players.filter(p => p.origin == origin) : this.players;
    }

    /**
     * Get a single Player by their ID or from Mentioning them in a message.
     * 
     * @param {Discord.Message | String} key 
     * @returns {?Player} 
     */
    getPlayer(key) {
        if (key instanceof String) return this.players.get(key);
        if (key instanceof Discord.Message && key.mentions.members.size == 1) {
            return this.players.get(key.mentions.members.first().id);
        }
    }

    /**
     * Edit a bot message, or send a new one if there is none.
     * 
     * @param {Discord.TextChannel} channel The channel where the message is
     * @param {Discord.APIMessage | Discord.StringResolvable} content the bot message
     * @returns the new message
     */
    async refreshBotMsg(channel, content) {
        let ref = this.botMessages.get(channel.id);
        let message;
        if (ref) {
            message = await channel.messages.fetch(ref);
            if (message && await wEditMsg(message, content)) {
                return message;
            }
        }
        message = await wSendChannel(channel, content);
        this.botMessages.set(channel.id, message.id)
        return message;
    }

    /**
     * @param {Discord.TextChannel} channel 
     * @param {number} limit
     * @return array containing all messages of the channel
     */
    async fetchAllMessages(channel, limit = 500) {
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

    async cacheAnnouncements() {
        log.trace(`caching announcements: start`);
        let ch = this.channels.cache.get(Guilds.Remedy.announcements)
        this.annCache = await cacheReactions(this, ch);
        log.trace('caching announcements: done');
    }
}

