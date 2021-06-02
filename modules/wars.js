const { Collection, MessageEmbed, Message } = require('discord.js');
const log = require('log4js').getLogger('modules/wars');

// For easier management and formatting
class War {
    constructor(origin, guildname, reason) {
        this.origin = origin ? origin : 'unknown';
        this.guildname = guildname;
        this.guildkey = guildname.toLowerCase();
        this.reason = reason ? ' ' + reason : '';
    }

    // line in embed
    toString() {
        return `${this.guildname} (\`${this.guildkey}\`) ${this.reason ? '~ ' + this.reason : ''}`;
    }

    // line in warlog
    log(action) {
        let tx = ''
        tx += this.origin ? `${this.origin}: ` : ''
        tx += `${action} `
        tx += `${this.guildname} ${this.reason}`;
        return tx;
    }
}

class GuildWars {
    static channels = ["849210902589997056"];
    constructor() {
        this.data = new Collection();
        this.warlog = [];
        this.botmsg;
        this.recovering = false;
        this.channel = null;
        log.mark('GuildWars - Instanciated');
    }
    
    // it's late right now, I'll make a better solution another day...
    // ... famous last words
    selfRefreshWrapper() {
        if (this.botmsg) {
            this.refreshEmbed(this.botmsg);
        } else if (this.channel) {
            this.channel.messages.fetch({ limit: 1 })
                .then(m => this.refreshEmbed(m))
                .catch(e => log.error(`failed to fetch a single message... so useless`, e));
        } else {
            log.error('cannot self-refresh due to missing references');
        }
    }

    dec(origin, guild, ...reason) {
        let war = new War(origin, guild, reason.join(' '));
        log.debug(`set [${war.guildkey}] -> [${war.log('dec')}]`);
        this.data.set(war.guildkey, war);
        this.warlog.push(war.log('dec'));
    }

    undec(origin, guild, ...reason) {
        let war = new War(origin, guild, reason.join(' '));
        log.debug(`unset [${war.guildkey}] -> [${war.log('undec')}]`);
        if (!this.data.delete(guild.toLowerCase())) {
            log.debug(`Unable to undec ${guild}, not at war.`);
        } else {
            this.warlog.push(war.log('undec'));
        }
    }

    clear() {
        this.warlog = [];
        this.data = new Collection();
        if (this.botmsg) {
            this.botmsg.delete()
                .then(m => this.sendNewEmbed(m))
                .catch(e => log.error(e));
        } else {
            log.warn('Cannot do ?clear before botmsg');
        }
    }

    /** @param {Message} msg @param {String} text */
    doAction(msg, text) {
        let args = text.trim().split(/ +/);
        let cmd = args.shift();
        let res = '';
        // dec https://regex101.com/r/
        if (cmd.match(/^d(e?c{0,2}l?|ec)[a-z]{0,4}$/i)) {
            if (args.length > 1) this.dec(msg.member.displayName.split('|')[0], args.shift(), ...args);
            else if (args.length > 0) res = 'Invalid arguments! missing: `reason`'
            else res = 'Invalid arguments! missing: `guild` `reason`';
        // undec https://regex101.com/r/
        } else if (cmd.match(/^[un](?<=u?)n?de?c{0,2}[a-z]{0,4}$/i)) {
            if (args.length > 0) this.undec(msg.member.displayName.split('|')[0], args.shift(), ...args);
            else res = 'Invalid arguments! missing: `guild`';
        } else {
            res = 'Invalid command! usage: `[dec|undec] [guildname] [reason]`\nNote that `reason` is obligatory for `dec`, but not for `undec`';
        }
        if (res) {
            msg.member.send(res)
                .then(() => {})
                .catch(e => log.error(e));
        }
    }

    /** @param {Message} msg */
    async handler(msg) {
        let text = msg.content;

        // ignore self - technically speaking redundant...
        if (msg.member.id == msg.client.user.id) {
            return;

        // Officers can leave comments in the channel by prefixing the message with !
        } else if (text.startsWith("! ") && msg.member.roles.cache.find(x => x.name.includes("Officer"))) {
            log.trace('ignoring note');
            return; // no refresh

        // remove message by id { utility hack due to lack of permissions on testserver }
        } else if (text.startsWith('?rm') && msg.member.roles.cache.find(x => x.name.includes("Officer"))) {
            msg.delete()
                .then(msg => {
                    let id = text.trim().split(/ +/)[1];
                    msg.channel.messages.fetch(id)
                        .then(m => {
                            m.delete().then().catch(e => log.warn(`(?rm) failed to remove target ${m.id}`, e)); 
                        })
                        .catch(e => log.debug(`(?rm) failed to fetch message [${id}] (most likely already deleted)`, e));
                }).catch(e => log.error(`(?rm) failed to remove trigger ${m.id}`, e));
            return; // no refresh

        // Officers can mark messages from before the bot was active to be parsed
        } else if (text.startsWith('?parse') && msg.member.roles.cache.find(x => x.name.includes("Officer"))) {
            text.trim().split(/ +/).slice(1).forEach(id => {
                log.debug(`?parse: fetching ${id}`);
                msg.channel.messages.fetch(id)
                    .then(m => {
                        log.trace(`?parse: handling ${m.member.displayName.split('|')[0]}: ${m.content}`);
                        this.handler(m, msg.client);
                    }).catch(e => log.warn(`(?parse) failed to fetch ${id}`, e));
            });

        // Officers can clear all entries
        // THIS WILL CLEAR BOTH WARS AND THE WARLOG
        } else if (text.startsWith('?clear') && msg.member.roles.cache.find(x => x.name.includes("Officer"))) {
            this.clear();
            msg.delete().then().catch(e => log.error(`(?clear) failed to remove trigger message`, e));
            return; // no refresh.

        // Officers can specify an old embed to load data from by providing the id.
        // THIS WILL RESET THE CURRENT DATA
        } else if (text.startsWith("?load") && msg.member.roles.cache.find(x => x.name.includes("Officer"))) {
            log.debug('load start');
            let id = text.trim().split(/ +/)[1];

            msg.channel.messages.fetch(id)
                .then(m => {
                    this.loadFromEmbed(m.embeds[0]);
                    log.debug('load completed');
                }).catch(e => log.error(`(?load) failed to fetch ${id}`, e));
            

        } else {
            this.doAction(msg, text);
        }
        // TODO priority: low require: reredevcommands
        // add repeat timer for refresh hook botmsg to client.botMessages
        msg.delete()
            .then(m => this.refreshEmbed(m))
            .catch(e => log.error('(handler) failed to delete trigger message', e));
    }

    /** Embed Stuff */

    /** @returns {MessageEmbed} */
    makeEmbed() {
        if (this.warlog.length == 0) this.warlog.push('- no entries -');
        // Will work as long as it doesn't grow past 20, but it should never grow past 11 in the first place
        else if (this.warlog.length > 10) this.warlog.slice((this.warlog.length - 10));

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

    /** @param {Message} msg */
    refreshEmbed(msg) {
        if (this.botmsg) {
            this.botmsg.edit(this.makeEmbed())
                .catch(e => {
                    log.warn();
                    log.error(`(refresh) failed to edit the botmessage ${this.botmsg}`, e);
                });

        // after startup or refresh error
        } else if (!this.botmsg && !this.recovering) {
            this.recovering = true;
            this.lookForOldData(msg);
        } else {
            log.trace(`recovery in progress ignoring message ${msg.id}`);
        }
    }

    /** @param {Message} msg */
    lookForOldData(msg) {
        log.info('Searching for last known state...');
        msg.channel.messages.fetch({ limit: 10 }) // TODO increase quantity
            .then(history => {
                log.debug(`filtering ${history.size} messages`);
                // last known state
                let past = history.filter(m => m.author.bot && m.embeds.length == 1).first()
                if (past) {
                    log.debug(`found last data: ${past.id}`);
                    this.loadFromEmbed(past.embeds[0]);
                    this.sendNewEmbed(msg);
                    past.delete().catch(e => log.error(`(lookForOldData) failed to delete previous state message`, e));
                } else {
                    log.warn('could not find previous state');
                    this.sendNewEmbed(msg);
                }
            }).catch(e => log.error(`(lookForOldData) failed to fetch channel history`, e));
    }

    /** @param {Message} msg */
    sendNewEmbed(msg) {
        msg.channel.send(this.makeEmbed())
            .then(m => {
                this.botmsg = m;
                log.info(`set botmsg id: ${this.botmsg.id}`);
            }).catch(e => log.error(`(sendNewEmbed) failed to send a new embed`, e));
        this.recovering = false;
    }

    /** @param {MessageEmbed} embed */
    loadFromEmbed(embed) {
        this.warlog = [];
        this.data = new Collection();

        embed.description.split('\n').forEach(line => {
            log.trace(`load warlog line: ${line}`);
            this.warlog.push(line);
        });

        embed.fields[0].value.split('\n')
            .filter(l => !l.startsWith('No active wars...'))
            .forEach(line => {
                log.trace(`parsing warfield line: ${line}`);

                let [guild, ...reason] = line.split(/ +/);
                // log.trace(`guild: ${guild}, skip: ${skip}, skip2: ${skip2}, reason: ${reason}`);
                if (reason) reason.shift(); // get rid of `~`
                if (reason) reason.shift(); // get rid of guildkey

                let war = new War(null, guild, reason.join(' '));
                let search = this.warlog.find(l => l.endsWith(war.log('dec')));
                if (search) war.origin = search.split(': ')[0];
                // log.trace(`origin: ${search ? war.origin : 'not found'}`);
                log.trace(`added warfield line: [${war}]`);
                this.data.set(guild.toLowerCase(), war);
            })
    }
}

module.exports = GuildWars;
