const Discord = require('discord.js');

/**
 * 
 */
module.exports = class Server extends Discord.Guild{
    constructor(args) {
        super();
        Object.assign(this, args);
    }
    toString() {
        return `Server: ${this.name} (${this.id})`
    }
}