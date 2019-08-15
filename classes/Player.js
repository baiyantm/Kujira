/**
 * Player class (member: GuildMember, classname: string, ap: string, aap: string, dp:string)
 */
module.exports = class Player {
    constructor(member, classname, ap, aap, dp, hidden) {
        //id can be null
        this.id = member ? member.id : undefined;
        this.name = member ? member.displayName : "default";
        this.classname = classname;
        this.ap = ap;
        this.aap = aap;
        this.dp = dp;
        this.hidden = hidden;
        
        /**
         * @param {string} name
         * @returns the first part of a string separated by |
         */
        this.applyNamePolicy = function(name) {
            let split = name.split("|");
            return split.length == 2 ? split[0].trim() : name;
        }
        this.name = this.applyNamePolicy(this.name);

        /**
         * @returns a string with the name + indication whether driver
         */
        this.display = function () {
            return this.hidden ? this.name : this.name + " " + this.valueFormat(this.ap) + " / " + this.valueFormat(this.aap) + " / " + this.valueFormat(this.dp);
        };

        /**
         * @returns a string with the name + indication whether driver
         */
        this.displayNoName = function () {
            return this.valueFormat(this.ap) + " / " + this.valueFormat(this.aap) + " / " + this.valueFormat(this.dp);
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
         * compares two players to see if they're the same person (their id is the same or else their name is the same)
         * @param {Player} player
         * @returns true same, false different
         */
        this.equals = function (player) {
            var res = false;
            if (this.id && player.id) {
                res = player.id == this.id;
            } else {
                res = player.name.toLowerCase() == this.name.toLowerCase();
            }
            return res;
        };

        this.getNameOrMention = function () {
            return this.id ? "<@" + this.id + ">" : this.name;
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
    }
}