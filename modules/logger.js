// @ts-check
const Discord = require("discord.js");

// ------ logging ------

/**
 * @returns {string} timestamp string (yyyy-mm-dd hh:min)
 */
function timestamp() {
    var today = new Date();
    var min = today.getMinutes();
    var hh = today.getHours();
    var dd = today.getDate();
    var mm = today.getMonth() + 1; //January is 0!
    var yyyy = today.getFullYear();
    // @ts-ignore
    if (min < 10) { min = '0' + min }
    // @ts-ignore
    if (hh < 10) { hh = '0' + hh }
    // @ts-ignore
    if (dd < 10) { dd = '0' + dd }
    // @ts-ignore
    if (mm < 10) { mm = '0' + mm }
    return yyyy + '-' + mm + '-' + dd + " " + hh + ':' + min;
}

/**
 * output in console
 * @param {string} string 
 */
function log(string) {
    var toWrite = timestamp() + ": " + string;
    console.log(toWrite);
}

/**
 * output an error in console
 * @param {string} string the message to write
 * @param {any} e the exception that occured
 */
function logError(string, e) {
    var toWrite = timestamp() + ": " + string;
    console.log("ERROR: " + toWrite);
    console.debug(e);
}

/**
 * output in a channel
 * @param {string} string what to write
 * @param {Discord.TextChannel} channel the dest channel
 */
function logToChannel(string, channel) {
    var toWrite = timestamp() + ": " + string;
    console.log(toWrite);
    channel.send(toWrite);
}

module.exports.timestamp = timestamp;
module.exports.log = log;
module.exports.logError = logError;
module.exports.logToChannel = logToChannel;