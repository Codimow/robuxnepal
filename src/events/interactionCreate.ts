import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  Collection,
} from "discord.js";
import { config } from "../utils/config";
import { PaymentSheetService } from "../utils/sheets";
import { VerificationUtils } from "../utils/verification";

interface ExtendedClient {
  commands: Collection<string, any>;
}

export = {
  name: "interactionCreate",
  async execute(
    interaction:
      | ChatInputCommandInteraction
      | ButtonInteraction
      | ModalSubmitInteraction,
  ) {
    const client = interaction.client as any;

    try {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction, client);
      } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      }
    } catch (error) {
      console.error("Error handling interaction:", error);
      await handleInteractionError(interaction, error);
    }
  },
};

// Handle slash commands
async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: ExtendedClient,
) {
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  await command.execute(interaction);
}

// Handle button interactions
async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId === "create_ticket") {
    await handleCreateTicketButton(interaction);
  } else if (customId.startsWith("verify_payment_")) {
    await handleVerifyPaymentButton(interaction);
  } else if (customId.startsWith("quick_verify_")) {
    await handleQuickVerifyButton(interaction);
  }
}

// Handle modal submissions
async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  if (interaction.customId === "ticket_modal") {
    await handleTicketModalSubmit(interaction);
  } else if (interaction.customId.startsWith("verify_modal_")) {
    await handleVerifyModalSubmit(interaction);
  }
}

// Create ticket button handler
async function handleCreateTicketButton(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("ticket_modal")
    .setTitle("Robux Purchase Ticket");

  const usernameInput = new TextInputBuilder()
    .setCustomId("roblox_username")
    .setLabel("Your Roblox Username")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter your Roblox username...")
    .setRequired(true)
    .setMaxLength(20);

  const robuxInput = new TextInputBuilder()
    .setCustomId("robux_amount")
    .setLabel("Amount of Robux")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter the amount of Robux you want...")
    .setRequired(true)
    .setMaxLength(10);

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    usernameInput,
  );
  const secondActionRow =
    new ActionRowBuilder<TextInputBuilder>().addComponents(robuxInput);

  modal.addComponents(firstActionRow, secondActionRow);
  await interaction.showModal(modal);
}

// Verify payment button handler (opens modal for detailed verification)
async function handleVerifyPaymentButton(interaction: ButtonInteraction) {
  // Check moderator permissions
  if (!VerificationUtils.hasModeratorPermission(interaction)) {
    return await interaction.reply({
      embeds: [VerificationUtils.createPermissionDeniedEmbed()],
      ephemeral: true,
    });
  }

  // Extract order ID from button custom ID
  const orderId = interaction.customId.split("_")[2];

  const modal = new ModalBuilder()
    .setCustomId(`verify_modal_${orderId}`)
    .setTitle(`Verify Payment - ${orderId}`);

  const notesInput = new TextInputBuilder()
    .setCustomId("verification_notes")
    .setLabel("Verification Notes (Optional)")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Add any additional notes about this verification...")
    .setRequired(false)
    .setMaxLength(500);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    notesInput,
  );
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

// Quick verify button handler (direct approval without modal)
async function handleQuickVerifyButton(interaction: ButtonInteraction) {
  // Check moderator permissions
  if (!VerificationUtils.hasModeratorPermission(interaction)) {
    return await interaction.reply({
      embeds: [VerificationUtils.createPermissionDeniedEmbed()],
      ephemeral: true,
    });
  }

  // Extract order ID and status from button custom ID
  const [, , orderId, status] = interaction.customId.split("_");

  await interaction.deferReply();

  try {
    await VerificationUtils.processVerification(
      interaction,
      orderId,
      status as "complete" | "incomplete",
      "Quick verification by moderator",
    );
  } catch (error) {
    console.error("Error in quick verify:", error);
    await interaction.editReply({
      embeds: [
        VerificationUtils.createVerificationErrorEmbed(
          "Error processing verification. Please try again.",
        ),
      ],
    });
  }
}

// Handle ticket modal submission
async function handleTicketModalSubmit(interaction: ModalSubmitInteraction) {
  const robloxUsername =
    interaction.fields.getTextInputValue("roblox_username");
  const robuxAmount = interaction.fields.getTextInputValue("robux_amount");

  await interaction.deferReply({ ephemeral: true });

  try {
    // Validate robux amount
    const robuxAmountNum = parseInt(robuxAmount);
    if (isNaN(robuxAmountNum) || robuxAmountNum <= 0) {
      throw new Error("Invalid Robux amount");
    }

    // Create ticket channel
    const ticketChannel = await createTicketChannel(
      interaction,
      robloxUsername,
      robuxAmountNum,
    );

    // Generate order ID
    const orderId = VerificationUtils.generateOrderId();

    // Save to Google Sheets
    await PaymentSheetService.addPayment({
      orderId,
      discordUsername: interaction.user.tag,
      discordUserId: interaction.user.id,
      robloxUsername,
      robuxAmount: robuxAmountNum,
      paymentAmount: robuxAmountNum,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // Create ticket embed with verification buttons
    const ticketEmbed = await createTicketEmbed(
      interaction,
      robloxUsername,
      robuxAmountNum,
      orderId,
    );
    const verifyButtons = VerificationUtils.createVerificationButtons(orderId);

    await ticketChannel.send({
      content: `<@&${config.MODERATOR_ROLE_ID}> New ticket created!`,
      embeds: [ticketEmbed],
      components: [verifyButtons],
    });

    // Send instructions
    await sendTicketInstructions(ticketChannel);

    // Confirm to user
    await sendTicketConfirmation(
      interaction,
      ticketChannel,
      robloxUsername,
      robuxAmountNum,
    );
  } catch (error) {
    console.error("Error creating ticket:", error);
    await sendTicketError(interaction);
  }
}

// Handle verification modal submission
async function handleVerifyModalSubmit(interaction: ModalSubmitInteraction) {
  const orderId = interaction.customId.split("_")[2];
  const notes =
    interaction.fields.getTextInputValue("verification_notes") ||
    "No additional notes provided";

  // Create verification options
  const verifyEmbed = VerificationUtils.createVerificationEmbed(orderId, notes);
  const verifyButtons =
    VerificationUtils.createFinalVerificationButtons(orderId);

  await interaction.reply({
    embeds: [verifyEmbed],
    components: [verifyButtons],
    ephemeral: true,
  });

  // Handle final verification buttons
  const collector = interaction.channel?.createMessageComponentCollector({
    filter: (i) =>
      i.user.id === interaction.user.id &&
      i.customId.startsWith("final_verify_"),
    time: 30000,
    max: 1,
  });

  collector?.on("collect", async (buttonInteraction) => {
    const [, , , status] = buttonInteraction.customId.split("_");
    await buttonInteraction.deferUpdate();

    try {
      await VerificationUtils.processVerification(
        interaction,
        orderId,
        status as "complete" | "incomplete",
        notes,
      );
      await interaction.editReply({
        embeds: [
          VerificationUtils.createVerificationSuccessEmbed(orderId, status),
        ],
        components: [],
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [
          VerificationUtils.createVerificationErrorEmbed(
            "Failed to process verification. Please try again.",
          ),
        ],
        components: [],
      });
    }
  });

  collector?.on("end", (collected) => {
    if (collected.size === 0) {
      interaction.editReply({
        embeds: [VerificationUtils.createVerificationTimeoutEmbed()],
        components: [],
      });
    }
  });
}

// Utility functions

async function createTicketChannel(
  interaction: ModalSubmitInteraction,
  robloxUsername: string,
  robuxAmount: number,
) {
  const permissionOverwrites = [
    {
      id: interaction.guild!.roles.everyone,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  if (
    config.MODERATOR_ROLE_ID &&
    config.MODERATOR_ROLE_ID !== "MODERATOR_ROLE_ID"
  ) {
    permissionOverwrites.push({
      id: config.MODERATOR_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  return await interaction.guild!.channels.create({
    name: `${config.TICKET_CHANNEL_PREFIX}${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: config.TICKET_CATEGORY_ID || undefined,
    permissionOverwrites: permissionOverwrites,
  });
}

async function createTicketEmbed(
  interaction: ModalSubmitInteraction,
  robloxUsername: string,
  robuxAmount: number,
  orderId: string,
) {
  const paymentAmount = robuxAmount;

  const embed = new EmbedBuilder()
    .setColor(config.EMBED_COLORS.SUCCESS)
    .setTitle("🎫 New Robux Purchase Ticket")
    .setDescription(`A new ticket has been created by ${interaction.user}`)
    .addFields(
      { name: "🆔 Order ID", value: orderId, inline: true },
      {
        name: "👤 User",
        value: `${interaction.user.tag} (${interaction.user.id})`,
        inline: true,
      },
      { name: "🎮 Roblox Username", value: robloxUsername, inline: true },
      { name: "💰 Robux Amount", value: robuxAmount.toString(), inline: true },
      { name: "💳 Payment Amount", value: `Rs.${paymentAmount}`, inline: true },
      { name: "📊 Status", value: "⏳ Pending Payment", inline: true },
      {
        name: "📅 Created",
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
        inline: false,
      },
    )
    .setFooter({ text: "Robux Nepal Ticket System" })
    .setTimestamp();

  if (config.QR_CODE_URL) {
    embed.setImage(config.QR_CODE_URL);
  }

  return embed;
}

async function sendTicketInstructions(channel: any) {
  const instructionsEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLORS.INFO)
    .setTitle("📋 Ticket Instructions")
    .setDescription("Welcome to your ticket! Please follow these instructions:")
    .addFields(
      {
        name: "💳 Payment",
        value: "Please make the payment as instructed above",
        inline: false,
      },
      {
        name: "📸 Screenshot",
        value: "Send a screenshot of your payment receipt in this channel",
        inline: false,
      },
      {
        name: "⚠️ Important",
        value:
          "Only image files (PNG, JPG, GIF, WebP) are allowed in this channel",
        inline: false,
      },
      {
        name: "⏱️ Response Time",
        value: "A moderator will verify your payment shortly",
        inline: false,
      },
    )
    .setFooter({ text: "Robux Nepal Support Team" })
    .setTimestamp();

  await channel.send({ embeds: [instructionsEmbed] });
}

async function sendTicketConfirmation(
  interaction: ModalSubmitInteraction,
  ticketChannel: any,
  robloxUsername: string,
  robuxAmount: number,
) {
  const confirmEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLORS.SUCCESS)
    .setTitle("✅ Ticket Created Successfully!")
    .setDescription(`Your ticket has been created in ${ticketChannel}`)
    .addFields(
      { name: "🎮 Roblox Username", value: robloxUsername, inline: true },
      { name: "💰 Robux Amount", value: robuxAmount.toString(), inline: true },
      { name: "💳 Payment Amount", value: `Rs.${robuxAmount}`, inline: true },
    )
    .setFooter({ text: "A moderator will assist you shortly!" });

  if (config.QR_CODE_URL) {
    confirmEmbed.setImage(config.QR_CODE_URL);
  }

  await interaction.editReply({ embeds: [confirmEmbed] });
}

async function sendTicketError(interaction: ModalSubmitInteraction) {
  const errorEmbed = new EmbedBuilder()
    .setColor(config.EMBED_COLORS.ERROR)
    .setTitle("❌ Error Creating Ticket")
    .setDescription(
      "There was an error creating your ticket. Please try again later or contact an administrator.",
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [errorEmbed] });
}

async function handleInteractionError(interaction: any, error: any) {
  const errorMessage = "There was an error processing your request!";

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: errorMessage,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true,
      });
    }
  } catch (replyError) {
    console.error("Error sending error message:", replyError);
  }
}
