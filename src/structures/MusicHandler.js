const Rest = require("./Rest");
const util = require("../util");
const FiltersValues = require("../constants/FiltersValues");

module.exports = class MusicHandler {
    /** @param {import("discord.js").Guild} guild */
    constructor(guild) {
        this.guild = guild;
        this.volume = 100;
        this.loop = 0; // 0 = none; 1 = track; 2 = queue;
        this.previous = null;
        this.current = null;
        this.queue = [];
        this.filters = {
            doubleTime: false,
            nightcore: false,
            vaporwave: false,
            "8d": false,
            bassboost: false
        };
        this.bassboost = 0;
        /** @type {import("discord.js").TextChannel|null} */
        this.textChannel = null;
        this.shouldSkipCurrent = false;
    }

    get voiceChannel() {
        return this.guild.me.voice.channel;
    }

    /** @returns {import("../structures/MusicClient")} */
    get client() {
        return this.guild.client;
    }

    get player() {
        return this.client.manager.players.get(this.guild.id) || null;
    }

    get node() {
        return this.client.manager.nodes.get("main");
    }

    reset() {
        this.loop = 0;
        this.volume = 100;
        this.previous = null;
        this.current = null;
        this.queue = [];
        this.textChannel = null;
        for (const filter of Object.keys(this.filters)) {
            this.filters[filter] = false;
        }
        this.bassboost = 0;
    }

    /** @param {import("discord.js").VoiceChannel} voice */
    async join(voice) {
        if (this.player) return;
        await this.client.manager.join({
            channel: voice.id,
            guild: this.guild.id,
            node: this.node.id
        }, { selfdeaf: true });

        this.player
            .on("start", () => {
                this.current = this.queue.shift();
                if (this.textChannel) this.textChannel.send({embeds:[util.embed().setDescription(`🎶 | Now playing **${this.current.info.title}**.`)]});
            })
            .on("end", (data) => {
                if (data.reason === "REPLACED") return;
                this.previous = this.current;
                this.current = null;

                if (this.loop === 1 && !this.shouldSkipCurrent) this.queue.unshift(this.previous);
                else if (this.loop === 2) this.queue.push(this.previous);

                if (this.shouldSkipCurrent) this.shouldSkipCurrent = false;

                if (!this.queue.length) {
                    this.client.manager.leave(this.guild.id);
                    if (this.textChannel) this.textChannel.send({embeds:[util.embed().setDescription("✅ | Queue is empty. Leaving voice channel..")]});
                    this.reset();
                    return;
                }
                this.start();
            })
            .on("error", console.error);
    }

    /** @param {import("discord.js").TextChannel} text */
    setTextCh(text) {
        this.textChannel = text;
    }

    async load(query) {
        const res = await Rest.load(this.node, query, this.client.spotify);
        return res;
    }

    async start() {
        if (!this.player) return;
        await this.player.play(this.queue[0].track);
    }

    async pause() {
        if (!this.player) return;
        if (!this.player.paused) await this.player.pause(true);
    }

    async resume() {
        if (!this.player) return;
        if (this.player.paused) await this.player.pause(false);
    }

    async skip(to = 1) {
        if (!this.player) return;
        if (to > 1) {
            this.queue.unshift(this.queue[to - 1]);
            this.queue.splice(to, 1);
        }
        if (this.loop === 1 && this.queue[0]) this.shouldSkipCurrent = true;
        await this.player.stop();
    }

    async stop() {
        if (!this.player) return;
        this.loop = 0;
        this.queue = [];
        await this.skip();
    }

    async setVolume(newVol) {
        if (!this.player) return;
        const parsed = parseInt(newVol, 10);
        if (isNaN(parsed)) return;
        await this.player.volume(parsed);
        this.volume = newVol;
    }

    async setDoubleTime(val) {
        if (!this.player) return;
        this.filters.doubleTime = val;
        if (val) {
            this.filters.nightcore = false;
            this.filters.vaporwave = false;
        }
        await this.sendFilters();
    }

    async setNightcore(val) {
        if (!this.player) return;
        this.filters.nightcore = val;
        if (val) {
            this.filters.doubleTime = false;
            this.filters.vaporwave = false;
        }
        await this.sendFilters();
    }

    async setVaporwave(val) {
        if (!this.player) return;
        this.filters.vaporwave = val;
        if (val) {
            this.filters.doubleTime = false;
            this.filters.nightcore = false;
        }
        await this.sendFilters();
    }

    async set8D(val) {
        if (!this.player) return;
        this.filters["8d"] = val;
        await this.sendFilters();
    }

    async setBassboost(val) {
        if (!this.player) return;
        this.filters.bassboost = !!val;
        this.bassboost = val / 100;
        await this.sendFilters();
    }

    async sendFilters() {
        if (!this.player) return;
        const filters = {};
        for (const [filter, enabled] of Object.entries(this.filters)) {
            if (enabled && FiltersValues[filter]) {
                const filterValue = { ...FiltersValues[filter] };
                if (filter === "bassboost") {
                    filterValue.equalizer = filterValue.equalizer.map((x, i) => ({ band: i, gain: x * this.bassboost }));
                }
                Object.assign(filters, filterValue);
            }
        }
        await this.player.node.send({
            op: "filters",
            guildId: this.guild.id,
            ...filters
        });
    }
};
