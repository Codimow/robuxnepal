import {
  Client,
  GatewayIntentBits,
  Collection,
  ClientOptions,
} from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { logger } from "./utils/logger";

dotenv.config();

class MyClient extends Client {
  commands: Collection<string, any>;

  constructor(options: ClientOptions) {
    super(options);
    this.commands = new Collection();
  }
}

const client = new MyClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.log(`Failed to load command from ${file}:`, command);
  }
}

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Periodic cleanup is handled by ready event
// Auto-close is now handled immediately after completion in verification.ts

// Add interaction handler for slash commands and modals
// Interaction handling is now managed by the interactionCreate event handler

// Message handling is now managed by the messageCreate event handler

client.login(process.env.DISCORD_TOKEN);
