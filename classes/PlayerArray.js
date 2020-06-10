/**
 * PlayerArray class (array<Player>)
 */
const Discord = require("discord.js");
const util = require("../modules/util");

module.exports = class PlayerArray extends Array {
    constructor(classList) {
        super();
        this.classEmojis = [];
        this.classList = classList;
    }

    /**
     * sets the classEmojis attribute
     * @param {any[]} classEmojis 
     */
    setClassEmojis(classEmojis) {
        this.classEmojis = classEmojis;
    }

    /**
     * gets player from his id
     * @param {string} playerId 
     * @returns the player if present, null not present
     */
    get(playerId) {
        let results = this.filter(currentPlayer => currentPlayer.equals(playerId));
        if (results.length > 0) {
            return results[0];
        } else {
            return null;
        }
    }

    /**
     * gets the index of the player in the array by his id
     * @param {string} id 
     * @returns index if present, -1 not present
     */
    indexOf(id) {
        let foundIndex = -1;
        for (let i = 0; i < this.length; i++) {
            let currentPlayer = this[i];
            if (currentPlayer.equals(id)) {
                foundIndex = i;
            }
        }
        return foundIndex;
    }

    /**
     * removes player from the array
     * @param {string} id 
     * @returns the removed element, null if not found
     */
    remove(id) {
        let removed = null;
        let index = this.indexOf(id);
        if (index != -1) {
            removed = this.splice(index, 1);
        }
        return removed;
    }

    /**
     * adds player to the array
     * @param {Player} player 
     */
    add(player) {
        this.push(player);
    }

    /**
     * update data for existing player or add it
     * @param {Player} player 
     * @param {Player} succ 
     */
    findAndUpdate(player, succ) {
        let index = this.indexOf(player);
        if (index >= 0) {
            this[index].updateStats(player.ap, player.aap, player.dp);
            if (this[index].getClassName() == player.getClassName()) {
                if (succ != null && succ != this[index].isSuccession()) {
                    this[index].toggleSucc();
                }
            } else {
                this[index].classname = player.classname;
                if (succ) {
                    this[index].toggleSucc();
                }
            }
        } else {
            this.add(player);
            if (succ) {
                player.toggleSucc();
            }
        }
    }

    /**
     * @param {string} classname 
     * @returns the number of players that have this classname
     */
    countClassNames(classname) {
        let res = 0;
        for (let i = 0; i < this.length; i++) {
            let player = this[i];
            if (player.getClassName() == classname) {
                res++;
            }
        }
        return res;
    }

    /**
     * @param {string} classname 
     * @returns array of players having this classname
     */
    getPlayersWithClass(classname) {
        return this.filter(currentPlayer => currentPlayer.getClassName() == classname);
    }

    // ----- DISPLAY -----

    /**
     * @param {string} classname 
     * @returns discord embed
     */
    getStatsEmbed(classname) {
        let players = this;
        if (classname) {
            players = players.getPlayersWithClass(classname);
        }
        const embed = new Discord.RichEmbed();
        let embedTitle = ":pencil: STATS" + (classname ? " for " + classname.charAt(0).toUpperCase() + classname.slice(1) : "");
        let embedColor = 3447003;
        embed.setColor(embedColor);
        embed.setTitle(embedTitle);

        if (players.length > 1) {
            let minAP = util.compare(players, (min, player) => {
                return player.isDpBuild() || player.name == "Uchaguzi" ? false : min.ap > player.ap;
            });
            let minAPplayers = players.filter(element => player.isDpBuild() || player.name == "Uchaguzi" ? false : element.ap == minAP.ap);
            let minAPstring = "";
            minAPplayers.forEach(player => {
                minAPstring += this.displayFullPlayer(player) + "\n";
            });

            let minAAP = util.compare(players, (min, player) => {
                return player.isDpBuild() || player.isSuccession() || player.name == "Uchaguzi" ? false : min.aap > player.aap;
            });
            let minAAPplayers = players.filter(element => player.isDpBuild() || player.isSuccession() || player.name == "Uchaguzi" ? false : element.aap == minAAP.aap);
            let minAAPstring = "";
            minAAPplayers.forEach(player => {
                minAAPstring += this.displayFullPlayer(player) + "\n";
            });

            let minDP = util.compare(players, (min, player) => {
                return min.dp > player.dp;
            });
            let minDPplayers = players.filter(element => element.dp == minDP.dp);
            let minDPstring = "";
            minDPplayers.forEach(player => {
                minDPstring += this.displayFullPlayer(player) + "\n";
            });

            let minGS = util.compare(players, (min, player) => {
                return min.getGS() > player.getGS();
            });
            let minGSplayers = players.filter(element => element.getGS() == minGS.getGS());
            let minGSstring = "";
            minGSplayers.forEach(player => {
                minGSstring += this.displayFullPlayer(player) + "\n";
            });

            let maxAP = util.compare(players, (max, player) => {
                return max.ap < player.ap;
            });
            let maxAPplayers = players.filter(element => element.ap == maxAP.ap);
            let maxAPstring = "";
            maxAPplayers.forEach(player => {
                maxAPstring += this.displayFullPlayer(player) + "\n";
            });

            let maxAAP = util.compare(players, (max, player) => {
                return max.aap < player.aap;
            });
            let maxAAPplayers = players.filter(element => element.aap == maxAAP.aap);
            let maxAAPstring = "";
            maxAAPplayers.forEach(player => {
                maxAAPstring += this.displayFullPlayer(player) + "\n";
            });

            let maxDP = util.compare(players, (max, player) => {
                return max.dp < player.dp;
            });
            let maxDPplayers = players.filter(element => element.dp == maxDP.dp);
            let maxDPstring = "";
            maxDPplayers.forEach(player => {
                maxDPstring += this.displayFullPlayer(player) + "\n";
            });

            let maxGS = util.compare(players, (max, player) => {
                return max.getGS() < player.getGS();
            });
            let maxGSplayers = players.filter(element => element.getGS() == maxGS.getGS());
            let maxGSstring = "";
            maxGSplayers.forEach(player => {
                maxGSstring += this.displayFullPlayer(player) + "\n";
            });

            let avgAP = util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.ap;
            });
            let avgAAP = util.avg(players, player => {
                return player.isDpBuild() || player.isSuccession() ? 0 : player.aap;
            });
            let avgDP = util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.dp;
            });
            let avgGS = util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.getGS();
            });
            if (!classname) {
                let countedClasses = [];
                this.classList.forEach(className => {
                    countedClasses[className] = 0;
                    players.forEach(player => {
                        if (player.getClassName() == className) {
                            countedClasses[className]++;
                        }
                    });
                });
                let max = 0;
                for (let index in countedClasses) {
                    max = Math.max(max, countedClasses[index]);
                }
                let maxStr = "";
                for (let index in countedClasses) {
                    let value = countedClasses[index];
                    if (value == max) {
                        maxStr += this.classEmojis.find(emoji => emoji.name == index) + " " + index.charAt(0).toUpperCase() + index.slice(1) + " **(" + value + ")**\n";
                    }
                }
                let min = 999;
                for (let index in countedClasses) {
                    min = Math.min(min, countedClasses[index]);
                }
                let minStr = "";
                for (let index in countedClasses) {
                    let value = countedClasses[index];
                    if (value == min) {
                        minStr += this.classEmojis.find(emoji => emoji.name == index) + " " + index.charAt(0).toUpperCase() + index.slice(1) + " **(" + value + ")**\n";
                    }
                }
                embed.addField("Most played",
                    maxStr,
                    true);
                embed.addField("Least played",
                    minStr,
                    true);
                embed.addBlankField(true);
            }
            embed.addField("Average gear : " + avgGS, util.valueFormat(util.valueFormat(avgAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgAAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgDP + "", 10), 100), true);
            embed.addField("Highest GS : " + maxGS.getGS(), maxGSstring, true);
            embed.addField("Highest AP : " + maxAP.ap, maxAPstring, true);
            embed.addField("Highest AAP : " + maxAAP.aap, maxAAPstring, true);
            embed.addField("Highest DP : " + maxDP.dp, maxDPstring, true);
            embed.addField("Lowest GS : " + minGS.getGS(), minGSstring, true);
            embed.addField("Lowest AP : " + minAP.ap, minAPstring, true);
            embed.addField("Lowest AAP : " + minAAP.aap, minAAPstring, true);
            embed.addField("Lowest DP : " + minDP.dp, minDPstring, true);
        } else if (players.length > 0) {
            embed.setDescription(this.displayFullPlayer(players[0]));
        } else {
            embed.setDescription("Empty player list.");
        }
        return embed;
    }

    /**
     * @param {number} day
     * @returns discord embed
     */
    getSignedUpStatsEmbed(players, day) {
        const embed = new Discord.RichEmbed();
        let embedTitle = ":pencil: STATS on " + util.findCorrespondingDayName(day);
        let embedColor = 3447003;
        embed.setColor(embedColor);
        embed.setTitle(embedTitle);

        if (players.length > 0) {
            embed.setDescription("Total players : " + players.length + " " + (players.length == players.length ? "" : (" (" + players.length + ")")));
            let avgAP = util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.ap;
            });
            let avgAAP = util.avg(players, player => {
                return player.isDpBuild() || player.isSuccession() ? 0 : player.aap;
            });
            let avgDP = util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.dp;
            });
            let avgGS = util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.getGS();
            });
            let classes = [];
            this.classList.forEach(currentClass => {
                classes.push({ "className": currentClass, "count": players.countClassNames(currentClass) });
            });
            classes.sort((a, b) => {
                return b["count"] - a["count"];
            });
            let classText = "";
            classes.forEach(currentClass => {
                classText += currentClass["count"] + "x " + this.classEmojis.find(emoji => emoji.name == currentClass["className"]) + " " + currentClass["className"].charAt(0).toUpperCase() + currentClass["className"].slice(1) + "\n";
            });
            embed.addField("Class list", classText, true);
            embed.addField("Average gear (" + avgGS + ")", util.valueFormat(util.valueFormat(avgAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgAAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgDP + "", 10), 100), true);
        } else {
            embed.setDescription("Empty player list.");
        }
        return embed;
    }

    /**
     * #gear embed
     * @returns discord embed
     */
    getEmbed() {
        const embed = new Discord.RichEmbed();
        let embedTitle = ":star: PLAYERS (" + this.length + ")";
        let embedColor = 3447003;
        embed.setColor(embedColor);
        embed.setTitle(embedTitle);
        let sortedList = [];
        this.classList.forEach(className => {
            sortedList.push({ name: className, count: this.countClassNames(className) });
        });
        sortedList.sort((a, b) => {
            return b.count - a.count;
        });
        if (this.length > 0) {
            sortedList.forEach(classListElement => {
                let classcount = this.countClassNames(classListElement.name);
                if (classcount > 0) {
                    let fieldContent = "";
                    let fieldTitle = classListElement.name.charAt(0).toUpperCase() + classListElement.name.slice(1) + " (" + classcount + ")\n";
                    let playersToShow = [];
                    this.forEach(player => {
                        if (player.getClassName() == classListElement.name) {
                            playersToShow.push(player);
                        }
                    });
                    playersToShow.sort((a, b) => {
                        var nameA = a.name.toLowerCase(), nameB = b.name.toLowerCase();
                        if (nameA < nameB) //sort string ascending
                            return -1;
                        if (nameA > nameB)
                            return 1;
                        return 0; //default return value (no sorting)
                    });
                    playersToShow.forEach(player => {
                        fieldContent += this.displayFullPlayer(player) + "\n";
                    });
                    embed.addField(fieldTitle, fieldContent, true);
                }
            });
        } else {
            embed.setDescription("Player list is empty :(");
        }
        return embed;
    }

    /**
     * @param {Player} player 
     * @returns a string containing the server class emoji and the player display
     */
    displayFullPlayer(player) {
        return this.classEmojis.find(emoji => emoji.name == player.getEmojiClassName()) + "\xa0" + player;
    }
}