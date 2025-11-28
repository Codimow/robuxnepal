import {
  Client,
  GatewayIntentBits,
  Collection,
  ClientOptions,
} from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

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

// Function to check and delete completed tickets after 24 hours
async function checkAndDeleteCompletedTickets() {
  try {
    const { PaymentSheetService } = require("./utils/sheets");
    const { EmbedBuilder } = require("discord.js");
    const { config } = require("./utils/config");

    const paymentsToDelete =
      await PaymentSheetService.getCompletedPaymentsForDeletion();

    for (const payment of paymentsToDelete) {
      try {
        // Find the guild and channel
        const guilds = client.guilds.cache;
        for (const guild of guilds.values()) {
          const channel = guild.channels.cache.get(payment.ticketChannelId);
          if (
            channel &&
            channel.isTextBased() &&
            "name" in channel &&
            channel.name.startsWith(config.TICKET_CHANNEL_PREFIX)
          ) {
            const deleteEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.INFO)
              .setTitle("🗑️ Ticket Auto-Deletion")
              .setDescription(
                "This ticket is being automatically deleted as the order was completed 24+ hours ago.",
              )
              .addFields(
                { name: "🆔 Order ID", value: payment.orderId, inline: true },
                {
                  name: "📅 Completed",
                  value: `<t:${Math.floor(new Date(payment.completionTimestamp!).getTime() / 1000)}:R>`,
                  inline: true,
                },
              )
              .setFooter({ text: "Robux Nepal Ticket System" })
              .setTimestamp();

            await channel.send({ embeds: [deleteEmbed] });

            // Wait 5 seconds before deleting to show the message
            setTimeout(async () => {
              try {
                await channel.delete(
                  "Order completed - Auto-deletion after 24 hours",
                );
                console.log(
                  `Deleted ticket channel for order ${payment.orderId}`,
                );
              } catch (err) {
                console.error(
                  `Error deleting channel for order ${payment.orderId}:`,
                  err,
                );
              }
            }, 5000);
          }
        }
      } catch (error) {
        console.error(
          `Error processing deletion for order ${payment.orderId}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.error("Error checking for completed tickets:", error);
  }
}

// Check for completed tickets every hour
setInterval(checkAndDeleteCompletedTickets, 60 * 60 * 1000);

// Run check on bot start
client.once("ready", () => {
  console.log("Checking for tickets that need auto-deletion...");
  checkAndDeleteCompletedTickets();
});

// Add interaction handler for slash commands and modals
// Interaction handling is now managed by the interactionCreate event handler

// Handle messages in ticket channels
client.on("messageCreate", async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Check if message is in a ticket channel
  const { config } = require("./utils/config");
  if (
    !message.channel.isTextBased() ||
    !("name" in message.channel) ||
    !message.channel.name.startsWith(config.TICKET_CHANNEL_PREFIX)
  )
    return;

  // Check if message has attachments
  if (message.attachments.size === 0) {
    // Delete non-image messages
    try {
      await message.delete();
      const { EmbedBuilder } = require("discord.js");
      const warning = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.WARNING)
        .setTitle("⚠️ Invalid Message")
        .setDescription(
          "Only payment screenshots (images) are allowed in this ticket channel.",
        )
        .setFooter({
          text: "Please send only images of your payment receipt.",
        });

      await message.channel.send({ embeds: [warning] });
    } catch (error) {
      console.error("Error handling invalid message:", error);
    }
    return;
  }

  // Check if all attachments are images
  const { AttachmentType } = require("discord.js");
  const validImageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  for (const attachment of message.attachments.values()) {
    if (
      !attachment.contentType ||
      !validImageTypes.includes(attachment.contentType)
    ) {
      try {
        await message.delete();
        const { EmbedBuilder } = require("discord.js");
        const error = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.ERROR)
          .setTitle("❌ Invalid File Type")
          .setDescription(
            "Only image files (PNG, JPG, GIF, WebP) are allowed for payment screenshots.",
          )
          .setFooter({ text: "Please send only image files." });

        await message.channel.send({ embeds: [error] });
      } catch (error) {
        console.error("Error handling invalid file type:", error);
      }
      return;
    }
  }

  // If we get here, it's a valid image message
  try {
    const { EmbedBuilder } = require("discord.js");
    const { PaymentSheetService } = require("./utils/sheets");

    // Get the first attachment (screenshot)
    const firstAttachment = message.attachments.first();
    if (!firstAttachment) return;

    // Generate unique order ID
    const orderId = `RBX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Extract payment info from channel topic or previous messages
    // For now, we'll get it from the channel name and make some assumptions
    // Try to get robux amount and roblox username from recent messages in the channel
    let robuxAmount = 0;
    let robloxUsername = "Unknown";
    try {
      const messages = await message.channel.messages.fetch({ limit: 10 });
      for (const msg of messages.values()) {
        if (msg.embeds.length > 0) {
          const embed = msg.embeds[0];
          if (embed.fields) {
            for (const field of embed.fields) {
              if (field.name === "💰 Robux Amount") {
                robuxAmount = parseInt(field.value) || 0;
              }
              if (field.name === "🎮 Roblox Username") {
                robloxUsername = field.value;
              }
            }
          }
        }
        if (robuxAmount > 0 && robloxUsername !== "Unknown") break;
      }
    } catch (error) {
      console.error("Error fetching messages for ticket info:", error);
    }

    // Store payment data
    const paymentData = {
      orderId: orderId,
      robloxUsername: robloxUsername,
      discordUsername: message.author.tag,
      discordUserId: message.author.id,
      robuxAmount: robuxAmount,
      paymentAmount: robuxAmount, // 1 Robux = 1 NPR
      screenshotUrl: firstAttachment.url,
      createdAt: new Date().toISOString(),
      status: "incomplete" as const,
      ticketChannelId: message.channel.id,
    };

    // Save to Google Sheets
    await PaymentSheetService.addPayment(paymentData);

    const paymentEmbed = new EmbedBuilder()
      .setColor(config.EMBED_COLORS.INFO)
      .setTitle("📸 Payment Screenshot Received")
      .setDescription(`Payment screenshot submitted by ${message.author}`)
      .addFields(
        { name: "🆔 Order ID", value: orderId, inline: true },
        {
          name: "👤 User",
          value: `${message.author.tag} (${message.author.id})`,
          inline: true,
        },
        {
          name: "📅 Submitted",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true,
        },
        { name: "🎮 Roblox Username", value: robloxUsername, inline: true },
        {
          name: "💰 Robux Amount",
          value: robuxAmount.toString(),
          inline: true,
        },
        { name: "💳 Payment Amount", value: `Rs.${robuxAmount}`, inline: true },
        {
          name: "📎 Screenshot",
          value: `[View Image](${firstAttachment.url})`,
          inline: true,
        },
        { name: "📊 Status", value: "🟡 Incomplete", inline: true },
        {
          name: "📎 Attachments",
          value: `${message.attachments.size} image(s)`,
          inline: true,
        },
      )
      .setFooter({ text: "Robux Nepal Payment Verification" })
      .setTimestamp();

    // Add the first image as embed image
    paymentEmbed.setImage(firstAttachment.url);

    // Send confirmation
    await message.channel.send({ embeds: [paymentEmbed] });

    // Add reaction to original message
    await message.react("✅");
  } catch (error) {
    console.error("Error processing payment screenshot:", error);
  }
});

client.login(process.env.DISCORD_TOKEN);
