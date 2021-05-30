const timestamp = require('../modules/logger').timestamp;

/**
 * Logger
 * 
 * @param {number} loglevel
 */
module.exports = class Logger {
    constructor (loglevel = 3) {
        if (loglevel < 0) {
            this._loglevel = 0;
        } else if (loglevel > 5) {
            this._loglevel = 5;
        } else {
            this._loglevel = loglevel;
        }
        this._log(3, `Logger initialized to ${this._level(loglevel)} mode`);
    }

    _isEnabled (loglevel) {
        if (loglevel > this._loglevel) {
            return false;
        } else {
            return true;
        }
    }
    _level (loglevel) {
        switch (loglevel) {
            case 0: return 'CRITICAL';
            case 1: return 'ERROR';
            case 2: return 'WARNING';
            case 3: return 'INFO';
            case 4: return 'DEBUG';
            case 5: return 'TRACE';
            default:
                break;
        }
    }

    _log (level, msg, err) {
        if (!this._isEnabled(level)) {
            return;
        }
        console.log(`${timestamp()} ${this._level(level)}: ${msg}`);
        if (err != null) {
            console.debug(err);
        }
    }

    critical (msg, e=null) {this._log(0, msg, e);}
    error (msg, e=null) {this._log(1, msg, e);}
    warning (msg, e=null) {this._log(2, msg, e);}
    info (msg, e=null) {this._log(3, msg, e);}
    debug (msg, e=null) {this._log(4, msg, e);}
    trace (msg, e=null) {this._log(5, msg, e);}

    err (msg, e=null) {this.error(msg, e);}
    warn (msg, e=null) {this.warning(msg, e);}
}