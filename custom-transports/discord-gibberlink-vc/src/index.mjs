import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { joinVoiceChannel } from "@discordjs/voice";

const OPENCLAW_CONFIG =
  process.env.OPENCLAW_CONFIG || "/home/openclaw/.openclaw/openclaw.json";

function readDiscordToken(configPath) {
  const full = path.resolve(configPath);
  const raw = fs.readFileSync(full, "utf8");
  const json = JSON.parse(raw);
  const token = json?.channels?.discord?.token;
  if (!token || typeof token !== "string") {
    throw new Error("Discord token not found in openclaw.json");
  }
  return token;
}

const GUILD_ID = process.env.GUILD_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const TEXT_CHANNEL_ID = process.env.TEXT_CHANNEL_ID;

if (!GUILD_ID || !VOICE_CHANNEL_ID || !TEXT_CHANNEL_ID) {
  console.error("Missing env: GUILD_ID / VOICE_CHANNEL_ID / TEXT_CHANNEL_ID");
  process.exit(1);
}

const token = readDiscordToken(OPENCLAW_CONFIG);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(VOICE_CHANNEL_ID);

  if (!channel || !channel.isVoiceBased()) {
    throw new Error("VOICE_CHANNEL_ID is not a voice channel");
  }

  joinVoiceChannel({
    channelId: VOICE_CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });

  console.log(`Joined VC: ${VOICE_CHANNEL_ID}`);
  console.log(`Transport active. receive/send keyword: gibberlink`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== TEXT_CHANNEL_ID) return;

  const normalized = message.content.trim().toLowerCase();

  // receive: gibberlink only
  if (normalized !== "gibberlink") return;

  console.log(`[recv] ${message.author.tag}: ${message.content}`);

  // send: gibberlink only
  await message.reply("gibberlink");
  console.log("[send] gibberlink");
});

client.login(token);
