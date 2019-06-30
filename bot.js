const Discord = require('discord.js');

// ------ bot general behavior ------
const bot = new Discord.Client();
const token = "NTk0ODQ1ODg1MTcxNjMwMDkw.XRikRw._sZlEM9D0vYT342vcac4ol4ZnVs";
bot.login(token);
bot.once('ready', async () => {
    console.log('INFO: Logged in as ' + bot.user.tag);
    setInterval(async () => {
        try {
            await bot.user.setPresence({ game: { name: new Date() } });
        } catch (e) {
            console.log("Discord unreachable", e);
        }
    }, 60000);

    bot.on("message", async message => {
        if (message.author.bot) return;
        if (message.isMentioned(bot.user)) {
            message.channel.send(message.content);
        }
    });
});
