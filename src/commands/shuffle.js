const util = require("../util");

module.exports = {
    name: "shuffle",
    aliases: ["sf"],
    exec: async (ctx) => {
        const { music } = ctx;
        if (!music.player || !music.player.playing) return ctx.respond(util.embed().setDescription("❌ | Currently not playing anything."));
        if (!music.queue.length) return ctx.respond(util.embed().setDescription("❌ | Queue is empty."));
        if (!ctx.member.voice.channel)
            return ctx.respond(util.embed().setDescription("❌ | You must be on a voice channel."));
        if (ctx.guild.me.voice.channel && !ctx.guild.me.voice.channel.equals(ctx.member.voice.channel))
            return ctx.respond(util.embed().setDescription(`❌ | You must be on ${ctx.guild.me.voice.channel} to use this command.`));

        music.queue = util.shuffleArray(music.queue);

        ctx.respond(util.embed().setDescription(`✅ | Queue shuffled! Type \`${ctx.client.prefix}queue\` to see changes.`));
    }
};
