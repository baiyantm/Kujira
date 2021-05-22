import SignUp from '../classes/SignUp';
import SignUpArray from '../classes/SignUpArray';

const int = function (str) {
    return parseInt(str);
}

/**
 * 
 * @property {String} id
 * @property {String} name
 * @property {String} cls
 * @property {Number} ap
 * @property {Number} aap
 * @property {Number} dp
 * @property {Boolean} succession
 * @property {Number} axe 
 * @property {String} horse Discord.Emoji ?
 * @property {SignUpArray} signups
 * @property {Boolean} voted
 * @property {String} origin
 */
module.exports = class Player {
    /**
     * 
     * @param {String} id The Discord Member's id that this Player is linked to
     * @param {String} name The name of the player
     * @param {String} cls The players class
     * @param {String|Number} ap The players AP
     * @param {String|Number} aap The players AAP
     * @param {String|Number} dp The players DP
     */
    constructor(id, name, cls, ap, aap, dp) {
        // No, id cannot be null
        this.id = id;
        this.name = this.applyNamePolicy(name);
        this.cls = cls;
        this.ap = ap instanceof Number ? ap : int(ap);
        this.aap = aap instanceof Number ? aap : int(aap);
        this.dp = dp instanceof Number ? dp : int(dp);

        this.succession = undefined;
        this.axe = 0;
        this.horse = undefined;
        
        this.signups = new SignUpArray();
        this.voted = undefined;
        this.origin = undefined
    }

    // Update / set values
    update(info) {
        if (info.axe) this.setAxe(info.axe);
        if (info.succession) this.setSuccession(info.succession);
        if (info.ap) this.setAP(info.ap);
        if (info.aap) this.setAAP(info.aap);
        if (info.dp) this.setDP(info.dp);
        if (info.horse) this.setHorse(info.horse);
        if (info.origin) this.setOrigin(info.origin);
        if (info.cls) this.setCls(info.cls);
    }

    // for further extensions...
    setCls(cls) { this.cls = cls; }
    setAxe(axe) { this.axe = axe; }
    setSuccession(succession) { this.succession = succession; }
    setAP(ap) { this.ap = ap; }
    setAAP(aap) { this.aap = aap; }
    setDP(dp) { this.dp = dp; }
    setHorse(horse) { this.horse = horse; }
    setOrigin(origin) { this.origin = origin; }


    // Logic

    /**
     * @param {Player|String} player 
     */
    equals(player) {
        if (player instanceof Player && this.id === player.id) {
            return true;
        } else if (this.id === player) {
            return true;
        } else {
            return false;
        }
    }

    avgAP() { return this.succession ? this.ap : Math.round((this.ap + this.aap)/2); }

    gs() { return this.avgAP + this.dp; }

    isDPBuild() { return this.dp >= 425; } // TODO priority: none


    // Signups

    resetSignUps() { this.signups.reset(); }

    setSignUpDay(day, status) { this.signups[day].setStatus(status); }

    setSignUps(signups) {
        for (let i = 0; i < 7; i++) {
            this.signups[i] = new SignUp(signups[i].status, signups[i].date);
        }
    }


    // Export as object
    export() {
        return {
            'id': this.id, 'name': this.name, 'class': this.cls,
            'ap': this.ap, 'aap': this.aap, 'dp': this.dp, 'gs': this.gs(),
            'succession': this.succession ? 'yes' : 'no',
            'axe': this.axe, 'horse': this.horse
        };
    }


    // Strings

    mention() { return `<@${this.id}>`; }

    toString() { return this.display(); }

    classEmojiKey() { return `${this.classname}${this.succession ? "succ" : ""}`; }

    fmtGear() {
        return `${this.fmtInt(this.ap)} / ${this.fmtInt(this.aap)} / ${this.fmtInt(this.dp)}`;
    }

    // For the time being?
    /** @note Internal use only */
    applyNamePolicy(name) {
        let half = name.split('|');
        return half.length > 1 ? half[0].trim() : name;
    }

    // TODO priority: medium
    // test display
    display(showClass=false, showAxe=false, showHorse=false, showName=false, showGs=false) {
        // wtf is `\xa0` ?
        let text = '';
        text += showClass ? `${this.classEmoji()}\xa0` : '';
        text += showName ? `${this.name}\xa0` : '';
        text += (showHorse && this.horse && showAxe && this.axe) ? '\xa0-\xa0' : '';
        text += (showHorse && this.horse) ? `${this.horse}\xa0` : '';
        text += (showHorse && this.horse && showAxe && this.axe) ? '\xa0-\xa0' : '';
        text += (showAxe && this.axe) ? `**${this.fmtAxe()}**\xa0` : '';
        text += '\n';
        text += `\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0${this.fmtGear()}`;
        text += showGs ? `(${this.gs()})` : '';
        return text;
    }

    fmtAxe(showNone=false) {
        switch (this.axe) {
            case 1: return 'I';
            case 2: return 'II';
            case 3: return 'III';
            case 4: return 'IV';
            case 5: return 'V';
            case 0: return showNone ? 'none' : '';
            default: // never hurts to be safe...
                if (!this.axe instanceof Number) {
                    log.warn(`${this.name}\'s Axe is not a number! (${typeof this.axe})`);
                } else {
                    log.warn(`${this.name}\'s Axe is out or range! (${this.axe})`)
                }
                return '';
        }
    }

    fmtInt(int) {
        switch (int) {
            case int < -9: break;
            case int < 0: return ` ${int}`
            case int < 10: return `  ${int}`;
            case int < 100: return ` ${int}`;
            default: break;
        }
        log.warn(`player ${player.name} (${player.id}) has invalid gear stats!`);
        return 'err';
    }
}
