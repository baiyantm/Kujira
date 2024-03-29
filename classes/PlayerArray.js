// @ts-check
/**
 * PlayerArray class (array<Player>)
 */
const util = require("../modules/util");
const Discord = require('discord.js');
const Player = require("./Player");

module.exports = class PlayerArray extends Array {
    constructor(classList, horseList) {
        super();
        this.classEmojis = [];
        this.horseEmojis = [];
        this.classList = classList;
        this.horseList = horseList;
    }

    /**
     * sets the classEmojis attribute
     * @param {any[]} classEmojis 
     */
    setClassEmojis(classEmojis) {
        this.classEmojis = classEmojis;
    }

    /**
     * sets the horseEmojis attribute
     * @param {any[]} horseEmojis 
     */
    setHorseEmojis(horseEmojis) {
        this.horseEmojis = horseEmojis;
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
     * @param {boolean} succ 
     */
    findAndUpdate(player, succ) {
        let index = this.indexOf(player.id);
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

    /**
     * @param {string} origin 
     * @returns array of players having this classname
     */
    getPlayersWithOrigin(origin) {
        return this.filter(currentPlayer => currentPlayer.origin == origin);
    }

    // ----- DISPLAY -----

    /**
         * @param {string} [classname]
         * @param {string} [origin] 
         * @returns discord embed
         */
    getRankingsEmbed(classname, origin) {
        let players = this;
        if (classname) {
            // @ts-ignore
            players = players.getPlayersWithClass(classname);
        }
        if (origin) {
            // @ts-ignore
            players = players.getPlayersWithOrigin(origin);
        }
        const embed = new Discord.MessageEmbed();
        let embedTitle = ":pencil: RANKINGS" + (classname ? " for " + classname.charAt(0).toUpperCase() + classname.slice(1) : "");
        let embedColor = 3447003;
        embed.setColor(embedColor);
        embed.setTitle(embedTitle);

        if (players.length > 1) {
            let sortedPlayers = players.sort((a, b) => b.getGS() - a.getGS());
            let sortedPlayersString = [];
            let playersPerField = 20;
            let index = 0;
            let rank = 0;
            let previousRank = { rank: 0, gs: 0 };
            sortedPlayers.forEach(player => {
                if (sortedPlayersString[index] == undefined) {
                    sortedPlayersString[index] = "";
                }
                let rankString = "";
                let rankToShow = previousRank.gs == player.getGS() ? previousRank.rank : rank;
                previousRank.rank = rankToShow;
                previousRank.gs = player.getGS();
                switch (rankToShow) {
                    case 0:
                        rankString = "🥇";
                        break;
                    case 1:
                        rankString = "🥈";
                        break;
                    case 2:
                        rankString = "🥉";
                        break;
                    default:
                        rankString = "**" + util.zeroString(Number(rankToShow) + 1) + "** : ";
                        break;
                }
                sortedPlayersString[index] += rankString + " (" + player.getGS() + ") " + player.name + "\n";
                rank++;
                if (rank % playersPerField == 0) {
                    index++;
                }
            });
            for (let i = 0; i < sortedPlayersString.length; i++) {
                const element = sortedPlayersString[i];
                embed.addField((i * playersPerField + 1) + " - " + (i + 1) * playersPerField,
                    element,
                    true);
            }
        } else if (players.length > 0) {
            embed.setDescription(this.displayFullPlayer(players[0]));
        } else {
            embed.setDescription("Empty player list.");
        }
        return embed;
    }

    /**
     * @param {string} [classname]
     * @param {string} [origin]
     * @returns discord embed
     */
    getStatsEmbed(classname, origin) {
        let players = this;
        if (classname) {
            // @ts-ignore
            players = players.getPlayersWithClass(classname);
        }
        if (origin) {
            // @ts-ignore
            players = players.getPlayersWithOrigin(origin);
        }
        const embed = new Discord.MessageEmbed();
        let embedTitle = ":pencil: STATS"
            + (classname ? " for " + classname.charAt(0).toUpperCase() + classname.slice(1) : "");
        let embedColor = 3447003;
        embed.setColor(embedColor);
        embed.setTitle(embedTitle);

        if (players.length > 1) {

            let stats = this.getMinMax(players);
            let avg = this.getAverages(players);
            let horses = this.getHorsesStats(players);

            if (!classname) {
                let countedClasses = this.getCountedClasses(players);
                let max = 0;
                for (let index in countedClasses) {
                    max = Math.max(max, countedClasses[index]);
                }
                let maxStr = this.getExtremePlayerString(max, countedClasses);
                let min = 999;
                for (let index in countedClasses) {
                    min = Math.min(min, countedClasses[index]);
                }
                let minStr = this.getExtremePlayerString(min, countedClasses);
                embed.addField("Most played",
                    maxStr,
                    true);
                embed.addField("Least played",
                    minStr,
                    true);
                embed.addField('\u200b', '\u200b')
            }
            // @ts-ignore
            embed.addField("Average gear : " + avg.gs, util.valueFormat(util.valueFormat(avg.ap + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avg.aap + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avg.dp + "", 10), 100), true);
            embed.addField("Highest GS : " + stats.max.gs.value.getGS(), stats.max.gs.string, true);
            embed.addField("Highest AP : " + stats.max.ap.value.ap, stats.max.ap.string, true);
            if (stats.max.aap.string) { //special case for player array full for succ players
                embed.addField("Highest AAP : " + stats.max.aap.value.aap, stats.max.aap.string, true);
            }
            embed.addField("Highest DP : " + stats.max.dp.value.dp, stats.max.dp.string, true);
            embed.addField("Lowest GS : " + stats.min.gs.value.getGS(), stats.min.gs.string, true);
            embed.addField("Lowest AP : " + stats.min.ap.value.ap, stats.min.ap.string, true);
            if (stats.min.aap.string) { //special case for player array full for succ players
                embed.addField("Lowest AAP : " + stats.min.aap.value.aap, stats.min.aap.string, true);
            }
            embed.addField("Lowest DP : " + stats.min.dp.value.dp, stats.min.dp.string, true);
            if (stats.max.axe.value.getAxe(true) != stats.min.axe.value.getAxe(true)) {
                embed.addField("Best Axe : " + stats.max.axe.value.getAxe(true), stats.max.axe.string, true);
                embed.addField("Worst Axe : " + stats.min.axe.value.getAxe(true), stats.min.axe.string, true);
            }
            let miscStr = "Average axe lv: " + avg.axe;
            miscStr += "\n" + horses;
            embed.addField("Miscellaneous : ", miscStr, true);
        } else if (players.length > 0) {
            embed.setDescription(this.displayFullPlayer(players[0]));
        } else {
            embed.setDescription("Empty player list.");
        }
        return embed;
    }

    /**
     * @param {number} day
     * @param {string} [origin]
     * @returns discord embed
     */
    getSignedUpStatsEmbed(players, day, origin) {
        const embed = new Discord.MessageEmbed();
        let embedTitle = ":pencil: STATS on " + util.findCorrespondingDayName(day);
        let embedColor = 3447003;
        embed.setColor(embedColor);
        embed.setTitle(embedTitle);

        if (origin) {
            // @ts-ignore
            players = players.getPlayersWithOrigin(origin);
        }
        if (players.length > 0) {
            embed.setDescription("Total players : " + players.length + " " + (players.length == players.length ? "" : (" (" + players.length + ")")));
            let avg = this.getAverages(players);
            let classes = [];
            this.classList.forEach(currentClass => {
                classes.push({ "className": currentClass, "count": players.countClassNames(currentClass) });
            });
            classes.sort((a, b) => {
                return b["count"] - a["count"];
            });
            let classText = "";
            classes.forEach(currentClass => {
                classText += currentClass["count"] + "x " + this.classEmojis.find(emoji => emoji.name == currentClass["className"]).toString() + " " + currentClass["className"].charAt(0).toUpperCase() + currentClass["className"].slice(1) + "\n";
            });
            embed.addField("Class list", classText, true);
            // @ts-ignore
            embed.addField("Average gear (" + avg.gs + ")", util.valueFormat(util.valueFormat(avg.ap + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avg.aap + "", 10), 100) + " / " + util.valueFormat(util.valueFormat(avg.dp + "", 10), 100), true);
        } else {
            embed.setDescription("Empty player list.");
        }
        return embed;
    }

    /**
     * #gear embed
     * @param {string} [origin]
     * @returns discord embed
     */
    getEmbed(origin) {
        const embed = new Discord.MessageEmbed();
        let players = this;
        if (origin) {
            // @ts-ignore
            players = players.getPlayersWithOrigin(origin);
        }
        let embedTitle = ":star: PLAYERS (" + players.length + ")";
        let embedColor = 3447003;
        embed.setColor(embedColor);
        embed.setTitle(embedTitle);
        /**
         * @type {{name : string, count : number}[]}
         */
        let sortedList = [];
        this.classList.forEach(className => {
            sortedList.push({ name: className, count: players.countClassNames(className) });
        });
        sortedList.sort((a, b) => {
            return b.count - a.count;
        });
        if (players.length > 0) {
            sortedList.forEach(classListElement => {
                let classcount = players.countClassNames(classListElement.name);
                if (classcount > 0) {
                    let fieldTitle = classListElement.name.charAt(0).toUpperCase() + classListElement.name.slice(1) + " (" + classcount + ")\n";
                    let fieldContent = this.getEmbedFieldContent(classListElement, players);
                    embed.addField(fieldTitle, fieldContent, true);
                }
            });
        } else {
            embed.setDescription("Player list is empty :(");
        }
        return embed;
    }

    /**
     * 
     * @param {{name : string, count : number}} classListElement 
     * @param {PlayerArray} players 
     * @returns 
     */
    getEmbedFieldContent(classListElement, players) {
        let fieldContent = "";
        /**
         * @type {Player[]}
         */
        let playersToShow = [];
        players.forEach(player => {
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
        return fieldContent;
    }

    /**
     * @param {Player} player 
     * @returns a string containing the server class emoji and the player display
     */
    displayFullPlayerGS(player) {
        return player.display(this.getClassEmoji(player), this.getHorseEmoji(player),
            true, true, true, true, true);
    }

    /**
     * @param {Player} player 
     * @returns a string containing the server class emoji and the player display
     */
    displayFullPlayer(player) {
        return player.display(this.getClassEmoji(player), this.getHorseEmoji(player),
            true, true, true, true, false);
    }

    /**
     * @param {Player} player 
     * @returns a string containing the server class emoji and the player display
     */
    displayPartPlayer(player) {
        return this.getClassEmoji(player) + "\xa0" + player.name;
    }

    /**
     * return the emoji matching the player's class
     * @param {Player} player 
     */
    getClassEmoji(player) {
        return this.classEmojis.find(emoji => emoji.name == player.getEmojiClassName()).toString();
    }

    /**
     * return the emoji matching the player's horse
     * @param {Player} player 
     */
    getHorseEmoji(player) {
        return player.horse ? this.horseEmojis.find(emoji => emoji.name == player.horse).toString() : '';
    }

    /**
     * return an array mapping classname to classname count
     * @param {PlayerArray} players 
     */
    getCountedClasses(players) {
        let countedClasses = [];
        this.classList.forEach(className => {
            countedClasses[className] = 0;
            players.forEach(player => {
                if (player.getClassName() == className) {
                    countedClasses[className]++;
                }
            });
        });
        return countedClasses;
    }

    /**
     * return a string containing players that match the extreme value of countedClasses
     * @see getCountedClasses()
     * @param {number} extreme 
     * @param {number[]} countedClasses 
     */
    getExtremePlayerString(extreme, countedClasses) {
        let extString = "";
        for (let index in countedClasses) {
            let value = countedClasses[index];
            if (value == extreme) {
                extString += this.classEmojis.find(emoji => emoji.name == index).toString() + " " + index.charAt(0).toUpperCase() + index.slice(1) + " **(" + value + ")**\n";
            }
        }
        return extString;
    }

    /**
     * return an object {ap, aap, dp, gs}
     * @param {PlayerArray} players
     * @returns {any}
     */
    getAverages(players) {
        let avg = {
            "ap": util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.ap;
            }),
            "aap": util.avg(players, player => {
                return player.isDpBuild() || player.isSuccession() ? 0 : player.aap;
            }),
            "dp": util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.dp;
            }),
            "gs": util.avg(players, player => {
                return player.isDpBuild() ? 0 : player.getGS();
            }),
            "axe": util.avg(players, player => {
                return player.axe;
            })
        };
        return avg;
    }

    /**
     * return an object 
     * {
     *  min {
     *      ap{value, string}, 
     *      aap{value, string}, 
     *      dp{value, string}, 
     *      gs{value, string}
     *  }, max {
     *      ap{value, string}, 
     *      aap{value, string}, 
     *      dp{value, string}, 
     *      gs{value, string}
     *      }
     * }
     * @param {PlayerArray} players
     * @returns {any}
     */
    getMinMax(players) {
        let minAP = util.compare(players, (min, player) => {
            return player.isDpBuild() ? false : min.ap > player.ap;
        });
        let minAPplayers = players.filter(element => element.isDpBuild() ? false : element.ap == minAP.ap);
        let minAPstring = "";
        minAPplayers.forEach(player => {
            minAPstring += this.displayFullPlayer(player) + "\n";
        });

        let minAAP = util.compare(players, (min, player) => {
            return (player.isDpBuild() || player.isSuccession()) ? false : min.aap > player.aap;
        });
        let minAAPplayers = players.filter(element => (element.isDpBuild() || element.isSuccession()) ? false : element.aap == minAAP.aap);
        let minAAPstring = "";
        minAAPplayers.forEach(player => {
            minAAPstring += this.displayFullPlayer(player) + "\n";
        });

        let minDP = util.compare(players, (min, player) => {
            return player.isDpBuild() ? false : min.dp > player.dp;
        });
        let minDPplayers = players.filter(element => element.isDpBuild() ? false : element.dp == minDP.dp);
        let minDPstring = "";
        minDPplayers.forEach(player => {
            minDPstring += this.displayFullPlayer(player) + "\n";
        });

        let minGS = util.compare(players, (min, player) => {
            return player.isDpBuild() ? false : min.getGS() > player.getGS();
        });
        let minGSplayers = players.filter(element => element.isDpBuild() ? false : element.getGS() == minGS.getGS());
        let minGSstring = "";
        minGSplayers.forEach(player => {
            minGSstring += this.displayFullPlayer(player) + "\n";
        });

        let minAxe = util.compare(players, (min, player) => {
            return min.axe > player.axe;
        });
        let minAxePlayers = players.filter(element => element.axe == minAxe.axe);
        let minAxestring = "";
        if (minAxePlayers.length < 10) {
            minAxePlayers.forEach(player => {
                minAxestring += this.displayPartPlayer(player) + "\n";
            });
        } else {
            minAxestring = "Way too many :confused:"
        }

        let maxAP = util.compare(players, (max, player) => {
            return player.isDpBuild() ? false : max.ap < player.ap;
        });
        let maxAPplayers = players.filter(element => element.isDpBuild() ? false : element.ap == maxAP.ap);
        let maxAPstring = "";
        maxAPplayers.forEach(player => {
            maxAPstring += this.displayFullPlayer(player) + "\n";
        });

        let maxAAP = util.compare(players, (max, player) => {
            return player.isDpBuild() ? false : max.aap < player.aap;
        });
        let maxAAPplayers = players.filter(element => element.isDpBuild() ? false : element.aap == maxAAP.aap);
        let maxAAPstring = "";
        maxAAPplayers.forEach(player => {
            maxAAPstring += this.displayFullPlayer(player) + "\n";
        });

        let maxDP = util.compare(players, (max, player) => {
            return player.isDpBuild() ? false : max.dp < player.dp;
        });
        let maxDPplayers = players.filter(element => element.isDpBuild() ? false : element.dp == maxDP.dp);
        let maxDPstring = "";
        maxDPplayers.forEach(player => {
            maxDPstring += this.displayFullPlayer(player) + "\n";
        });

        let maxGS = util.compare(players, (max, player) => {
            return player.isDpBuild() ? false : max.getGS() < player.getGS();
        });
        let maxGSplayers = players.filter(element => element.isDpBuild() ? false : element.getGS() == maxGS.getGS());
        let maxGSstring = "";
        maxGSplayers.forEach(player => {
            maxGSstring += this.displayFullPlayer(player) + "\n";
        });

        let maxAxe = util.compare(players, (max, player) => {
            return max.axe < player.axe;
        });
        let maxAxePlayers = players.filter(element => element.axe == maxAxe.axe);
        let maxAxestring = "";
        maxAxePlayers.forEach(player => {
            maxAxestring += this.displayPartPlayer(player) + "\n";
        });

        let minmax = {
            "min": {
                "ap": {
                    "value": minAP,
                    "string": minAPstring
                }
                ,
                "aap": {
                    "value": minAAP,
                    "string": minAAPstring
                },
                "dp": {
                    "value": minDP,
                    "string": minDPstring
                },
                "gs": {
                    "value": minGS,
                    "string": minGSstring
                },
                "axe": {
                    "value": minAxe,
                    "string": minAxestring
                }
            },
            "max": {
                "ap": {
                    "value": maxAP,
                    "string": maxAPstring
                }
                ,
                "aap": {
                    "value": maxAAP,
                    "string": maxAAPstring
                },
                "dp": {
                    "value": maxDP,
                    "string": maxDPstring
                },
                "gs": {
                    "value": maxGS,
                    "string": maxGSstring
                },
                "axe": {
                    "value": maxAxe,
                    "string": maxAxestring
                }
            },
        };
        return minmax;
    }

    /**
     * return an array mapping horsename to a displayable string
     * @param {PlayerArray} players 
     */
    getHorsesStats(players) {
        let horseStr = "";
        let horses = this.getCountedHorses(players);
        this.horseList.forEach(horseName => {
            horseStr += this.horseEmojis.find(emoji => emoji.name == horseName).toString() + " : " + horses[horseName] + "\n";
        });
        return horseStr;
    }

    /**
     * return an array mapping horsename to horsename count
     * @param {PlayerArray} players 
     */
    getCountedHorses(players) {
        let countedHorses = [];
        this.horseList.forEach(horseName => {
            countedHorses[horseName] = 0;
            players.forEach(player => {
                if (player.horse == horseName) {
                    countedHorses[horseName]++;
                }
            });
        });
        return countedHorses;
    }

    resetPlayersSignUps() {
        this.forEach(element => {
            element.resetSignUps();
        });
    }
}
