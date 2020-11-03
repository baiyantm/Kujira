// @ts-check
const http = require('https');
const fs = require('fs');
const logger = require('./logger');
const Discord = require('discord.js');

// ------ file interactions ------

/**
 * get a file from an url and write it in dest
 * @param {string} url the file's url
 * @param {string} dest the dest
 * @param {function} cb callback function
 */
async function download(url, dest, cb) {
    return new Promise((resolve, reject) => {
        var file = fs.createWriteStream(dest);
        http.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close();  // close() is async, call cb after close completes.
                resolve();
            });
        }).on('error', function (err) { // Handle errors
            fs.unlink(dest, () => { }); // Delete the file async. (But we don't check the result)
            if (cb) cb(err.message);
            reject();
        });
    });
};

/**
 * uploads a file to a channel
 * @param {string} filepath the path to the file to upload
 * @param {Discord.TextChannel} channel the dest channel
 * @param {string} content the dest channel
 */
function uploadFileToChannel(filepath, channel, content) {
    channel.send(content, {
        files: [
            filepath
        ]
    });
}

/**
 * reads and parse an object from a json file
 * @param {string} path the path to the json file
 * @param {string} encoding
 */
function openJsonFile(path, encoding) {
    try {
        // @ts-ignore
        var json = JSON.parse(fs.readFileSync(path, encoding));
        logger.log("FILE: \"" + path + "\" successfully opened.");
        return json;
    } catch (e) {
        logger.logError("Failed to open \"" + path + "\" ...aborting...", e);
    }
}

/**
 * writes an object into a json file
 * @param {string} path the path to the json file
 * @param {Object} data the data to be written
 */
function writeObjectToFile(path, data) {
    var cache = [];
    var json = JSON.stringify(data, function (key, value) {
        if (key != "member") {
            if (typeof value === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    // Duplicate reference found
                    try {
                        // If this value does not reference a parent it can be deduped
                        return JSON.parse(JSON.stringify(value));
                    } catch (error) {
                        // discard key if value cannot be deduped
                        return;
                    }
                }
                // Store value in our collection
                cache.push(value);
            }
            return value;
        }
        else {
            return value.id;
        }
    });
    fs.writeFileSync(path, json);
    logger.log("FILE: Wrote in \"" + path + "\" ...");
}


/**
 * writes an object into a json file
 * @param {string} path the path to the json file
 * @param {string} data the data to be written
 */
function writeToFile(path, data) {
    fs.writeFileSync(path, data);
    logger.log("FILE: Wrote in \"" + path + "\" ...");
}

module.exports.download = download;
module.exports.uploadFileToChannel = uploadFileToChannel;
module.exports.openJsonFile = openJsonFile;
module.exports.writeObjectToFile = writeObjectToFile;
module.exports.writeToFile = writeToFile;