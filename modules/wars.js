const log = require('log4js').getLogger('modules/wars');

const { MessageEmbed, Message } = require('discord.js');
const { wDelete } = require('./interactions');

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
    constructor() {
        this.wars = new Collection();
        this.warlog = [];
        log.trace('Instanciated');
    }

    // need a channel as key to botMessages
    clear(msg) {
        log.info(`Cleared internal state, source: ${msg.author}`)
        msg.client.botMessages.delete(msg.channel)
        this.warlog = []
        this.data = new Collection()
    }

    dec(origin, guild, ...reason) {
        let war = new War(origin, guild, reason.join(' '));
        log.debug(`set [${war.guildkey}] -> [${war.log('dec')}]`);
        this.wars.set(war.guildkey, war);
        this.warlog.push(war.log('dec'));
    }

    undec(origin, guild, ...reason) {
        let war = new War(origin, guild, reason.join(' '));
        log.debug(`unset [${war.guildkey}] -> [${war.log('undec')}]`);
        if (!this.wars.delete(guild.toLowerCase())) {
            log.debug(`Unable to undec ${guild}, not at war.`);
        } else {
            this.warlog.push(war.log('undec'));
        }
    }

    /**
     * @returns {MessageEmbed}
     */
    makeEmbed() {
        if (this.warlog.length == 0) this.warlog.push('- no entries -');

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

    /**
     * 
     * @param {Message} previous 
     * @returns {?Boolean} True if success, False (or undefined?) otherwise
     */
    async load(previous) {
        if (!previous) {
            log.warn(`Could not find previous state`);
            return false;
        }
        log.info(`Restoring previous state from ${previous.id}`);

        this.clear()
        let embed = previous.embeds[0];

        embed.description.split('\n').forEach(line => {
            log.trace(`load warlog line: ${line}`);
            this.warlog.push(line);
        });

        embed.fields[0].value.split('\n')
            .filter(l => !l.startsWith('No active wars...'))
            .forEach(line => {
                let traceText = 'parsing warfield'
                traceText += `\n\t\tline raw [${line}]`

                let [guild, ...reason] = line.split(/ +/);
                // Wait... we can't actually have wars without reason to begin with!
                // TODO priority: medium
                // Clean this shit up
                if (reason) traceText += `\n\t\t shifting [${reason.shift()}]` // get rid of `~`
                if (reason) traceText += `\n\t\t shifting [${reason.shift()}]` // get rid of guildkey
                traceText += `\n\t\tparsed result => guild: [${guild}] reason: [${reason.join(' ')}]`;
                let war = new War(null, guild, reason.join(' '));
                traceText += `\n\t\tresult [${war}]`
                log.trace(traceText)
                this.data.set(guild.toLowerCase(), war);
            })
        
        await wDelete(previous)
        return true
    }
}

module.exports = {
    War,
    GuildWars
}