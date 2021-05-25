const PlayerCollection = require('./playerCollection');

module.exports = class Server {
    constructor(args) {
        Object.assign(this, args);
        this.players = new PlayerCollection();
    }
    toString() {
        return `Server: ${this.name} (${this.id})`
    }
}