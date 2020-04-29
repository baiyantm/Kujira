/**
 * Player class (member: GuildMember | string, classname: string, ap: string, aap: string, dp:string, hidden:boolean, real:boolean)
 */
module.exports = class Player {
    constructor(member, classname, ap, aap, dp, hidden, real) {
        //id can be null
        this.id = real ? member.id : member;
        this.name = real ? member.displayName : member;
        this.classname = classname;
        this.ap = ap;
        this.aap = aap;
        this.dp = dp;
        this.hidden = hidden;
        this.real = real;

        /**
         * @param {string} name
         * @returns the first part of a string separated by |
         */
        this.applyNamePolicy = function (name) {
            let split = name.split("|");
            return split.length > 1 ? split[0].trim() : name;
        }
        this.name = this.applyNamePolicy(this.name);

        /**
         * @returns a string with the name
         */
        this.display = function () {
            return this.hidden ? this.name : this.name + "\xa0\xa0" + this.valueFormat(this.ap) + "\xa0/\xa0" + this.valueFormat(this.aap) + "\xa0/\xa0" + this.valueFormat(this.dp);
        };

        /**
         * @returns a string with the name
         */
        this.displayNoName = function () {
            return this.valueFormat(this.ap) + "\xa0/\xa0" + this.valueFormat(this.aap) + "\xa0/\xa0" + this.valueFormat(this.dp);
        };

        /**
         * @param {number} value
         * @returns 00 + value if < 10, 0 + value if < 100
         */
        this.valueFormat = function (value) {
            if (value < 10) {
                value = "0" + value;
            }
            if (value < 100) {
                value = "0" + value;
            }
            return value;
        }

        /**
         * compares two players to see if have the same id or the same name
         * also accepts player ID as parameter
         * @param {Player | string} player
         * @returns true same, false different
         */
        this.equals = function (player) {
            let equals = false;
            if(player) {
                let playerId = "";
                if(player instanceof Player) {
                    playerId = player.id;
                } else {
                    playerId = player;
                }
                equals = this.id.toLowerCase() == playerId.toLowerCase();
                if(!equals) {
                    equals = this.name.toLowerCase() == playerId.toLowerCase();
                }
            }
            return equals;
        };

        this.getNameOrMention = function () {
            return this.real ? "<@" + this.id + ">" : this.id;
        }

        this.toString = function () {
            return this.display();
        }

        /**
         * @returns (ap+aap)/2
         */
        this.getRealAP = function () {
            return this.hidden ? null : Math.round((parseInt(ap) + parseInt(aap)) / 2);
        }

        /**
         * @returns sum of real ap+dp
         */
        this.getGS = function () {
            return this.hidden ? null : Math.round(this.getRealAP() + parseInt(dp));
        }

        /**
         * @returns an object containing only attributes of a Player
         */
        this.getInfo = function () {
            return { "id": this.id, "name": this.name, "class": this.classname, "ap": this.ap, "aap": this.aap, "dp": this.dp, "gs" : this.getGS() }
        }
    }
}
