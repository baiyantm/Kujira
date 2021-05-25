const c = process.env.TOKEN ?
    require('./resources/static-default.json') :
    require('./resources/static.json');

c.Guilds.Remedy.BlacklistedMemberChannels = [
    c.Guilds.Remedy.attendance_updates,
    c.Guilds.Remedy.guild_wars,
    c.Guilds.Remedy.useful_stuff
];

c.Guilds.Remedy.WhitelistedMemberChannels = [
    c.Guilds.Remedy.guild_chat,
    c.Guilds.Remedy.nodewar_pvp,
    c.Guilds.Remedy.bots
];

// Allow lookup by name or id
c[c.Guilds.Remedy.id] = c.Guilds.Remedy;

c["prefix"] = "?";

module.exports = c;
