module.exports = {
    name: 'ready',
    once: true,
    execute(bot) {
        log.info(`Ready! Logged in as ${bot.user.tag}`);
    },
};