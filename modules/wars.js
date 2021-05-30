const { Collection, MessageEmbed, Message} = require('discord.js');
const { wSendChannel } = require('./interactions');
const { wDelete, wEditMsg } = require('./interactions.js');

// replaces all other logging on branch reredevcommands
// until then...
const log4js = require('log4js')
log4js.configure({
    "appenders": {
        "out": {
            "type": "stdout",
            "layout": {
                "type": "pattern",
                "pattern": "%[%d{yyyy-MM-dd hh:mm}  %-8.8p %-17.17c %m%]"
            }
        },
        "file": {
            "type": "multiFile",
            "base": "logs/",
            "property": "categoryName",
            "extension": ".log"
        }
    },
    "categories": {
        "default": {
            "appenders": ["out", "file"],
            "level": "trace"
        },
        "modules/sheets": {
            "appenders": ["file"],
            "level": "trace"
        }
    }
});
const log = log4js.getLogger('modules/wars');

// Action Map
const actions = new Collection([
    ['dec', {
        minargs: 2,
        execute(m, a) { decAction(m, a); }
    }],
    ['undec', {
        minargs: 1,
        execute(m, a) { undecAction(m, a); } 
    }],
]);

// For easier management and formatting
class War {
    constructor(origin, guildname, reason, logonly=false) {
        this.origin = origin;
        this.guildname = guildname;
        this.reason = reason ? ' ' + reason : '';
        this.logonly = logonly;
    }
    toString() {
        return `${this.guildname} (\`${this.guildname.toLowerCase()}\`) ~ ${this.reason}`;
    }
    log() {
        return `${this.origin.username}: ${this.logonly ? 'undec' : 'dec'} ${this.guildname}${this.reason}`
    }
}

module.exports = class GuildWars {
    static channels = ["646472790555361310"];
    constructor() {
        this.data = new Collection();
        this.warlog = [];
        this.botmsg;
        log.info('initialized');
    }

    // hacks for now. TODO: js static/classmethod ??
    logWar(war) { this.warlog.push(war.log()); };

    // internal use only
    _invalidate() { this.data = new Collection(); this.warlog = []; };

    async handler(msg, client) {
        if (msg.author.id == client.user.id) return; // ignore self
        let text = msg.content;

        // Officers can leave comments in the channel by prefixing the message with !
        if (text.startsWith("! ") && msg.member.roles.cache.find(x => x.name.includes("Officer"))) {
            log.trace('ignoring note');
            return;

        // utility hack due to lack of permissions on testserver
        } else if (text.startsWith('?rm') && msg.member.roles.cache.find(x => x.name.includes("Officer"))) {
            msg.channel.messages.fetch(text.trim().split(/ +/)[1])
                .then(async (m) => await wDelete(m))
                .catch(e => log.error(e));
        
        // Officers can specify an old embed to load data from by providing the id.
        } else if (text.startsWith("?load") && msg.member.roles.cache.find(x => x.name.includes("Officer"))) {

            log.trace('load start');
            let id = text.trim().split(/ +/)[1];

            msg.channel.messages.fetch(id)
                .then(async (m) => {
                    await this.loadFromEmbed(m);
                })
                .catch(e => log.error(e));
            log.trace('load completed');

        } else {
            let args = text.trim().split(/ +/);
            let target = args.shift().toLowerCase();
            let action = actions.get(target);
            if (action) {
                if (action.minargs && !(action.minargs >= args.length)) {
                    log.debug(`Invalid command! cmd:${target} args:${args.join(' ')}`);
                } else {
                    action.execute(msg, args);
                }
            }
        }
        await this.refreshEmbed(msg, client);
        // client.setTimeout(async () => await wDelete(msg), 10000); // 10 seconds (?)
        await wDelete(msg);
    }

    decAction(msg, args) {
        let guild = args.shift();
        let reason = args ? args.join(' ') : false;
        if (this.data.has(guild.toLowerCase()) && !reason) {
            log.debug(`Refusing to overwrite dec ${guild}, no reason provided.`);
            return;
        }
        let war = new War(msg.author, guild, reason)
        this.data.set(guild.toLowerCase(), war);
        this.logWar(war);
    }

    undecAction(msg, args) {
        let guild = args.shift();
        let reason = args ? args.join(' ') : false;
        if (this.data.delete(guild.toLowerCase())) {
            this.logWar(new War(msg.author, guild, reason, true));
        } else {
            log.debug(`Unable to undec ${guild}, not at war.`)
        }
    }

    makeEmbed() {
        if (this.warlog.length == 0) this.warlog.push('== warlog init ==');

        let text = '';
        this.data.forEach(war => text += war.toString() + '\n');
        if (!text) text = "No active wars...";

        let embed = new MessageEmbed({
            title: '\tWarlog (last 10 entries)',
            description: this.warlog.join('\n'),
            thumbnail: 'https://cdn.discordapp.com/emojis/607656540232482857.png?v=1',
            color: 'RED',
        });
        embed.addField(`Guild Wars ( ${this.data.size} / 6 )`, text, false);
        return embed;
    }

    async refreshEmbed(msg, client) {
        let embed = this.makeEmbed();
        // after startup or refresh error
        if (!this.botmsg) {
            this.botmsg = await wSendChannel(msg.channel, '**Parsing History, please wait...**');

            msg.channel.messages.fetch({limit: 2})
                .then(history => {
                    // search for last known state
                    let lastData = history.filter(m => m.author.id === client.user.id && m.id !== this.botmsg.id).first();
                    // TODO make more safe
                    if (lastData && lastData.embeds.length == 1 && lastData.embeds[0].description) {
                        this._invalidate();             // invalidate current state
                        this.loadFromEmbed(lastData);   // load last valid state
                        history                         // re-parse from there
                            .filter(m => m.createdTimestamp > lastData.createdTimestamp)
                            .sorted((m1, m2) => m1.createdTimestamp - m2.createdTimestamp)
                            .forEach(m => this.handler(m, client));
                    }
                    // if no last state is found, don't parse any history just start fresh.
                })
                .catch(e => log.error(e));
        }
        else {
            if (!wEditMsg(this.botmsg, embed)) {
                log.warn('failed to refresh botmsg!');
                this.botmsg = undefined;
            }
        }
    }

    /** @param {Message} msg */
    async loadFromEmbed(msg) {
        if (msg.embeds.length == 1) {

            msg.embeds[0].description.split('\n').forEach(line => {
                log.trace(`load warlog line: ${line}`)
                this.warlog.push(line);
            });

            msg.embeds[0].fields[0].value.split('\n').forEach(line => {
                log.trace(`load warfield line: ${line}`)

                let [guild, skip, ...reason] = line.split(/ +/);
                log.debug(`guild: ${guild}, skip: ${skip}, reason: ${reason}`);
                
                let search = this.warlog.find(s => s.endsWith(`dec ${guild} ${reason.join(' ')}`));

                let origin = 'unknown'; // if war entry is older than 10 log entries
                if (search) {
                    origin = search.pop().split(': ')[0];
                    log.trace(`origin: ${origin}`); 
                }
                let war = new War(origin, guild, reason.join(' '));
                log.info(`load war: ${war.toString()}`);
                this.data.set(guild.toLowerCase(), war);
            })
        }
    }
}

