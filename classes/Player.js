// @ts-check
const SignUpArray = require("./SignUpArray");
const SignUp = require("./SignUp");

/**
 * Player class (member: GuildMember | string, classname: string, ap: string, aap: string, dp:string, real:boolean)
 */
module.exports = class Player {
    /**
     * 
     * @param {*} member 
     * @param {*} classname 
     * @param {*} ap 
     * @param {*} aap 
     * @param {*} dp 
     * @param {*} real 
     */
    constructor(member, classname, ap, aap, dp, real) {
        //id can be null
        this.id = real ? member.id : member;
        this.name = real ? member.displayName : member;
        /**
         * @type string
         */
        this.classname = classname;
        this.ap = ap;
        this.aap = aap;
        this.dp = dp;
        this.real = real;
        this.axe = 0;
        this.signUps = new SignUpArray();

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
         * @returns a string with the name including gs
         */
        this.displayWithGS = function () {
            return this.name + " " + (this.hasAxe() ? "(**" + this.getAxe() + "**)" : "") + "\n\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0" + this.displayNoName() + " (" + this.getGS() + ")";
        };

        /**
         * @returns a string with the name
         */
        this.display = function () {
            return this.name + " " + (this.hasAxe() ? "(**" + this.getAxe() + "**)" : "") + "\n\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0" + this.displayNoName();
        };

        /**
         * @returns a string with the name
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
                // @ts-ignore
                value = "0" + value;
            }
            if (value < 100) {
                // @ts-ignore
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
            if (player) {
                let playerId = "";
                if (player instanceof Player) {
                    playerId = player.id;
                } else {
                    playerId = player;
                }
                equals = this.id.toLowerCase() == playerId.toLowerCase();
                if (!equals) {
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
            let realAP;
            if (this.isSuccession()) {
                realAP = this.ap;
            } else {
                realAP = Math.round((parseInt(this.ap) + parseInt(this.aap)) / 2);
            }
            return realAP;
        }

        /**
         * @returns sum of real ap+dp
         */
        this.getGS = function () {
            return this.getRealAP() + parseInt(this.dp);
        }

        /**
         * @returns an object containing only attributes of a Player
         */
        this.getInfo = function () {
            return { "id": this.id, "name": this.name, "class": this.getClassName(), "ap": this.ap, "aap": this.aap, "dp": this.dp, "gs": this.getGS(), "succession": (this.isSuccession() ? "yes" : "no"), "axe": this.axe }
        }

        /**
         * @returns whether the player is in succession
         */
        this.isSuccession = function () {
            return this.classname.endsWith("Succ");
        }

        /**
         * @returns the class striped down of any succ term
         */
        this.getClassName = function () {
            let classname = "";
            if (this.isSuccession()) {
                classname = this.classname.split("Succ")[0];
            } else {
                classname = this.classname;
            }
            return classname;
        }

        /**
         * @returns the class name for emoji
         */
        this.getEmojiClassName = function () {
            return this.classname;
        }

        this.setAP = function (ap) {
            this.ap = ap;
        }

        this.setAAP = function (aap) {
            this.aap = aap;
        }

        this.setDP = function (dp) {
            this.dp = dp;
        }

        /**
         * sets ap, aap and dp
         */
        this.updateStats = function (ap, aap, dp) {
            this.setAP(ap);
            this.setAAP(aap);
            this.setDP(dp);
        }

        this.toggleSucc = function () {
            if (this.isSuccession()) {
                this.unsetSucc();
            } else {
                this.setSucc();
            }
        }

        this.setSucc = function () {
            this.classname += "Succ";
        }

        this.unsetSucc = function () {
            // @ts-ignore
            this.classname = this.classname.substring(0, this.classname.length - 4);
        }

        this.isDpBuild = function () {
            return this.dp >= 425;
        }

        this.hasAxe = function () {
            return this.axe;
        }

        /**
         * @param {string} newAxe
         */
        this.setAxe = function (newAxe) {
            if (newAxe >= "0" && newAxe <= "5") {
                this.axe = Number(newAxe);
            } else {
                if (newAxe.toLowerCase().startsWith("pri") || newAxe.toLowerCase() == "i") {
                    this.axe = 1;
                } else if (newAxe.toLowerCase().startsWith("duo") || newAxe.toLowerCase() == "ii") {
                    this.axe = 2;
                } else if (newAxe.toLowerCase().startsWith("tri") || newAxe.toLowerCase() == "iii") {
                    this.axe = 3;
                } else if (newAxe.toLowerCase().startsWith("tet") || newAxe.toLowerCase() == "iv") {
                    this.axe = 4;
                } else if (newAxe.toLowerCase().startsWith("pen") || newAxe.toLowerCase() == "v") {
                    this.axe = 5;
                } else {
                    this.axe = 0;
                }
            }
        }

        this.getAxe = function (display0 = false) {
            switch (this.axe) {
                case 1:
                    return "I"
                case 2:
                    return "II"
                case 3:
                    return "III"
                case 4:
                    return "IV"
                case 5:
                    return "V"
                default:
                    return display0 ? "none" : "";
            }
        }

        this.setSignUpDay = function (day, status) {
            this.signUps[day].setStatus(status);
        }

        this.isReal = function () {
            return this.real;
        }

        this.setSignUps = function (signUps) {
            for (let i = 0; i < 7; i++) {
                this.signUps[i] = new SignUp(signUps[i].status, signUps[i].date);
            }
        }

        this.resetSignUps = function () {
            this.signUps.reset();
        }
    }
}
