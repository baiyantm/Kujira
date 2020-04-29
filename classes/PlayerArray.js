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
        if(index != -1) {
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
     * replace data of existing player or adds player if doesn't exist yet
     * @param {Player} player 
     */
    findAndReplace(player) {
        let index = this.indexOf(player);
        if (index >= 0) {
            this[index] = player;
        } else {
            this.add(player);
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
            if (player.classname == classname) {
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
        return players.filter(currentPlayer => currentPlayer.classname == classname);
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

        let playersWithoutHidden = players.filter(currentPlayer => !currentPlayer.hidden);
        if (playersWithoutHidden.length > 0) {
            let minAP = util.compare(playersWithoutHidden, (min, player) => {
                return min.ap > player.ap;
            });
            let minAPplayers = playersWithoutHidden.filter(element => element.ap == minAP.ap);
            let minAPstring = "";
            minAPplayers.forEach(player => {
                minAPstring += this.displayFullPlayer(player) + "\n";
            });

            let minAAP = util.compare(playersWithoutHidden, (min, player) => {
                return min.aap > player.aap;
            });
            let minAAPplayers = playersWithoutHidden.filter(element => element.aap == minAAP.aap);
            let minAAPstring = "";
            minAAPplayers.forEach(player => {
                minAAPstring += this.displayFullPlayer(player) + "\n";
            });

            let minDP = util.compare(playersWithoutHidden, (min, player) => {
                return min.dp > player.dp;
            });
            let minDPplayers = playersWithoutHidden.filter(element => element.dp == minDP.dp);
            let minDPstring = "";
            minDPplayers.forEach(player => {
                minDPstring += this.displayFullPlayer(player) + "\n";
            });

            let minGS = util.compare(playersWithoutHidden, (min, player) => {
                return min.getGS() > player.getGS();
            });
            let minGSplayers = playersWithoutHidden.filter(element => element.getGS() == minGS.getGS());
            let minGSstring = "";
            minGSplayers.forEach(player => {
                minGSstring += this.displayFullPlayer(player) + "\n";
            });

            let maxAP = util.compare(playersWithoutHidden, (max, player) => {
                return max.ap < player.ap;
            });
            let maxAPplayers = playersWithoutHidden.filter(element => element.ap == maxAP.ap);
            let maxAPstring = "";
            maxAPplayers.forEach(player => {
                maxAPstring += this.displayFullPlayer(player) + "\n";
            });

            let maxAAP = util.compare(playersWithoutHidden, (max, player) => {
                return max.aap < player.aap;
            });
            let maxAAPplayers = playersWithoutHidden.filter(element => element.aap == maxAAP.aap);
            let maxAAPstring = "";
            maxAAPplayers.forEach(player => {
                maxAAPstring += this.displayFullPlayer(player) + "\n";
            });

            let maxDP = util.compare(playersWithoutHidden, (max, player) => {
                return max.dp < player.dp;
            });
            let maxDPplayers = playersWithoutHidden.filter(element => element.dp == maxDP.dp);
            let maxDPstring = "";
            maxDPplayers.forEach(player => {
                maxDPstring += this.displayFullPlayer(player) + "\n";
            });

            let maxGS = util.compare(playersWithoutHidden, (max, player) => {
                return max.getGS() < player.getGS();
            });
            let maxGSplayers = playersWithoutHidden.filter(element => element.getGS() == maxGS.getGS());
            let maxGSstring = "";
            maxGSplayers.forEach(player => {
                maxGSstring += this.displayFullPlayer(player) + "\n";
            });

            let avgAP = util.avg(playersWithoutHidden, player => {
                return player.ap;
            });
            let avgAAP = util.avg(playersWithoutHidden, player => {
                return player.aap;
            });
            let avgDP = util.avg(playersWithoutHidden, player => {
                return player.dp;
            });
            let avgGS = util.avg(playersWithoutHidden, player => {
                return player.getGS();
            });
            if (!classname) {
                let countedClasses = [];
                this.classList.forEach(className => {
                    countedClasses[className] = 0;
                    players.forEach(player => {
                        if (player.classname == className) {
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
            embed.addBlankField(true);
            embed.addField("Highest AP : " + maxAP.ap, maxAPstring, true);
            embed.addField("Highest AAP : " + maxAAP.aap, maxAAPstring, true);
            embed.addBlankField(true);
            embed.addField("Highest DP : " + maxDP.dp, maxDPstring, true);
            embed.addField("Lowest GS : " + minGS.getGS(), minGSstring, true);
            embed.addBlankField(true);
            embed.addField("Lowest AP : " + minAP.ap, minAPstring, true);
            embed.addField("Lowest AAP : " + minAAP.aap, minAAPstring, true);
            embed.addBlankField(true);
            embed.addField("Lowest DP : " + minDP.dp, minDPstring, true);
        } else {
            embed.setDescription("Empty player list.");
        }
        return embed;
    }

    /**
     * @param {string} classname 
     * @param {number} day
     * @returns discord embed
     */
    getSignedUpStatsEmbed(players, classname, day) {
        if (this.classList.includes(className)) {
            players = players.getPlayersWithClass(classname);
        } else {
            classname = null;
        }
        const embed = new Discord.RichEmbed();
        let embedTitle = ":pencil: STATS on " + util.findCorrespondingDayName(day) + (classname ? " for " + classname.charAt(0).toUpperCase() + classname.slice(1) : "");
        let embedColor = 3447003;
        embed.setColor(embedColor);
        embed.setTitle(embedTitle);

        let playersWithoutHidden = players.filter(currentPlayer => !currentPlayer.hidden);
        if (playersWithoutHidden.length > 0) {
            embed.setDescription("Total players : " + playersWithoutHidden.length + " " + (playersWithoutHidden.length == players.length ? "" : (" (" + players.length + ")")));
            let avgAP = util.avg(playersWithoutHidden, player => {
                return player.ap;
            });
            let avgAAP = util.avg(playersWithoutHidden, player => {
                return player.aap;
            });
            let avgDP = util.avg(playersWithoutHidden, player => {
                return player.dp;
            });
            if (!classname) {
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
            }
            embed.addField("Average gear (" + ((avgAP + avgAAP) / 2 + avgDP) + ")", util.valueFormat(util.valueFormat(avgAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgAAP + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avgDP + "", 10), 100), true);
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
            let fields = 0;
            sortedList.forEach(classname => {
                let classcount = this.countClassNames(classname.name);
                if (classcount > 0) {
                    let fieldContent = "";
                    let fieldTitle = classname.name.charAt(0).toUpperCase() + classname.name.slice(1) + " (" + classcount + ")\n";
                    let playersToShow = [];
                    this.forEach(player => {
                        if (player.classname == classname.name) {
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
                    embed.addField("" + fieldTitle, fieldContent, true);
                    fields++;
                    if (fields % 2 == 0) {
                        embed.addBlankField(true);
                    }
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
        return this.classEmojis.find(emoji => emoji.name == player.classname) + "\xa0" + player;
    }
}