require("dotenv").config();

console.log("BOT STARTING...");
console.log(process.env.TOKEN ? "TOKEN OK" : "TOKEN MISSING");
console.log(process.env.CLIENT_ID ? "CLIENT_ID OK" : "CLIENT_ID MISSING");

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus
} = require("@discordjs/voice");

const play = require("play-dl");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music")
    .addStringOption(option =>
      option
        .setName("song")
        .setDescription("Song name or URL")
        .setRequired(true)
    )
].map(command => command.toJSON());

client.once("ready", async () => {

  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );

  console.log("Slash commands registered");
});

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "play") {

    const query = interaction.options.getString("song");

    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply("Join a voice channel first.");
    }

    await interaction.reply(`Searching for: ${query}`);

    try {

      const results = await play.search(query, { limit: 1 });

      if (!results.length) {
        return interaction.followUp("No song found.");
      }

      const song = results[0];

      const stream = await play.stream(song.url);

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
      });

      await entersState(
        connection,
        VoiceConnectionStatus.Ready,
        30000
      );

      const player = createAudioPlayer();

      connection.subscribe(player);

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });

      player.play(resource);

      await interaction.followUp(
        `Now playing: ${song.title}`
      );

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy();
      });

    } catch (error) {
      console.error(error);
      interaction.followUp("Error while playing music.");
    }
  }
});

client.login(process.env.TOKEN);