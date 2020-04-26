/**
 * PlayerArray class (array<Player>)
 */
module.exports = class PlayerArray extends Array {
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
}