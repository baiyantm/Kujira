// @ts-check
/**
 * SignUp class
 */
module.exports = class SignUp {
    constructor(status = "N/A", date) {
        this.status = status;
        this.date = date ? new Date(date) : undefined;

        this.setDate = function(date) {
            this.date = date;
        }
        
        this.setStatus = function(status) {
            if(this.status != status) {
                this.status = status;
                this.date = new Date();
            }
        }

        this.display = function() {
            this.status + " - " + this.date.getTime();
        }

        this.toString = function () {
            if (!this.date) {
                return 'N/A';
            } else {
                return this.display();
            }
        }
    }
}
