// TODO: priority: high


const log = require('log4js').getLogger('modules/playerArray');

// Types
const Player = require('./player');
const Discord = require('discord.js');

/**
 * @typedef {String|Discord.Message|Discord.GuildMember} key
 * @typedef {key[]} keys
 */

/**
 * 
 * remove = sweep 
 */
module.exports = class PlayerCollection extends Discord.Collection {
    constructor () { super(); }

    /**
     * Get a player from the array
     *
     * @param {Discord.GuildMember | String | Discord.User} key
     * @returns {?Player} The first Player object found, or null if none were found
     */
    get(key) {
        if (!key) {
            log.warn('players.get was called with an empty key!');
            return null;
        }
        log.trace(`Trying to get Player from ${this.name} using key ${key.id ? key.id : key}`);

        let player = null;
        if (key instanceof String) player = super.get(key.id);
        else player = super.get(key.id);

        if (!player) log.trace('Failed to get player');
        return player;
    }

    /**
     * 
     * @param {Player} player 
     */
    update(player) {
        this.set(player.id, player);
    }

    
    has(key) {
        try {
            key = key instanceof String ? key : key.id
            return super.has(key);
        } catch (e) {
            log.error(e);
            return null;
        }
    }

    /**
     * Add a player to the array
     * 
     * @param {Player} player The player to add
     * @returns {?Boolean} True if the player exists already, otherwise null
     */
    add(player) {
        if (this.has(player.id)) {
            log.debug(`Error when adding player: Player with id ${player.id} already exists.`);
            return null;
        }
        this.set(player.id, player);
    }

    /**
     * Update a player's information
     * 
     * @param {Player | String | Discord.User | Discord.GuildMember} key The player that should be updated
     * @param {Object} info The updated information
     * @param {?Boolean} upsert If true, will will try to add the player if it is not found. Defaults to false
     * @returns {?Player} The updated player object if it was updated or inserted
     */
    update(key, info, upsert=false) {
        if (!key) {
            log.warn('update no key!');
            return null;
        }

        // if key is a Player object, save it
        let player = key instanceof Player ? key : undefined;
        // from now on, key is a discord user id string
        key instanceof String ? key : key.id;

        // New Player -> upsert ?
        if (!this.has(key)) {
            if (!upsert) return null;
            if (!player) player = new Player(key);
            this.add(player);
        }

        return this._update(key, info);
    }

    _update(key, info) {
        this.set(key, this.get(key).update(info));
        return this.get(key);
    }
}