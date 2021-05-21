const constants = process.env.TOKEN ?
    require('./resources/static-default.json') :
    require('./resources/static.json');

module.exports = constants
