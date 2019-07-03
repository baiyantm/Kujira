/**
 * Player class (member: GuildMember, classname: string, ap: string, aap: string, dp:string)
 */
module.exports = class Player {
    constructor(member, classname, ap, aap, dp) {
        //id can be null
        this.id = member ? member.id : undefined;
        this.name = member ? member.displayName : "default";
        this.classname = classname;
        this.ap = ap;
        this.aap = aap;
        this.dp = dp;

        /**
         * @returns a string with the name + indication whether driver
         */
        this.display = function () {
            return this.name + " " + this.ap + " / " + this.aap + " / " + this.dp;
        };
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

        this.toString = function () {
            return this.display();
        }

        /**
         * @returns (ap+aap)/2
         */
        this.getRealAP = function () {
            return "" + Math.round((parseInt(ap) + parseInt(aap)) / 2);
        }

        /**
         * @returns sum of real ap+dp
         */
        this.getGS = function () {
            return "" + Math.round(this.getRealAP() + parseInt(dp));
        }
    }
}