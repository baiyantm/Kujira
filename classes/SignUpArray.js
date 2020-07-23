const SignUp = require("./SignUp");

/**
 * SignUpArray class
 */
module.exports = class SignUpArray extends Array {
    constructor() {
        super();
        for (let i = 0; i < 7; i++) {
            this[i] = new SignUp();
        }
    }
}
