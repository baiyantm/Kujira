// @ts-check
const Discord = require('discord.js');

/**
 * Server class
 */
module.exports = class Server {
    constructor() {
        /**
         * @type Discord.Guild
         */
        this.self;
        /**
         * @type Discord.TextChannel
         */
        this.myGate;
        /**
         * @type Discord.TextChannel
         */
        this.myGear;
        /**
         * @type Discord.TextChannel
         */
        this.myGearData;
        /**
         * @type Discord.TextChannel
         */
        this.mySignUp;
        /**
         * @type Discord.TextChannel
         */
        this.mySignUpData;
        /**
         * @type Discord.TextChannel
         */
        this.myAnnouncement;
        /**
         * @type Discord.TextChannel
         */
        this.myAnnouncementData;
        /**
         * @type Discord.TextChannel
         */
        this.myWelcome;
        /**
         * @type Discord.TextChannel
         */
        this.myChangelog;
        /**
         * @type Discord.TextChannel
         */
        this.myGuildChat;
        this.botMsg = {
            /**
             * @type Discord.Message
             */
            reference: null
        };
    }
}