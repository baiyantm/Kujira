const log = require('log4js').getLogger('utils/files');
const { existsSync, mkdirSync, createWriteStream, unlink } = require('fs');

module.exports = {
    /**
     * downloads files attached to the message and put it in download/messageid
     * @param {Discord.Message | Discord.PartialMessage} message
     */
    async downloadFilesFromMessage(message) {
        if (message.attachments.size > 0) {
            for (const iattachment of message.attachments) {
                let element = iattachment[1];
                try {
                    if (!existsSync("./download/" + message.id + "/")) {
                        mkdirSync("./download/" + message.id + "/");
                    }
                    await download(element.url, "./download/" + message.id + "/" + element.name, () => { });
                } catch (e) {
                    log.error("Could not download " + element.name + " file", e);
                    log.error(e);
                }
            }
        }
    },

    /**
     * get a file from an url and write it in dest
     * @param {string} url the file's url
     * @param {string} dest the dest
     * @param {function} cb callback function
     */
    async download(url, dest, cb) {
        return new Promise((resolve, reject) => {
            var file = createWriteStream(dest);
            https.get(url, function (response) {
                response.pipe(file);
                file.on('finish', function () {
                    file.close();  // close() is async, call cb after close completes.
                    resolve();
                });
            }).on('error', function (err) { // Handle errors
                unlink(dest, () => { }); // Delete the file async. (But we don't check the result)
                if (cb) cb(err.message);
                reject();
            });
        });
    }
}

