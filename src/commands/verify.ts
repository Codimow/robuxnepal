import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { config } from "../utils/config";
import { PaymentSheetService } from "../utils/sheets";

export = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify payment and complete the ticket (Moderators Only)")
    .addStringOption((option) =>
      option
        .setName("order_id")
        .setDescription("Order ID to verify")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Payment verification status")
        .setRequired(true)
        .addChoices(
          { name: "✅ Complete - Order Finished", value: "complete" },
          { name: "❌ Incomplete - Payment Invalid", value: "incomplete" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("notes")
        .setDescription("Additional notes about the verification")
        .setRequired(false),
    ),
  async execute(interaction: any) {
    // Check if the command is being used in a ticket channel
    if (!interaction.channel.name.startsWith(config.TICKET_CHANNEL_PREFIX)) {
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle("❌ Error")
        .setDescription("This command can only be used in ticket channels!")
        .setTimestamp();

      return await interaction.reply({
        embeds: [errorEmbed],
        flags: 64, // MessageFlags.Ephemeral
      });
    }

    // Check if user has the moderator role
    const hasModeratorRole =
      config.MODERATOR_ROLE_ID &&
      config.MODERATOR_ROLE_ID !== "MODERATOR_ROLE_ID" &&
      interaction.member.roles.cache.has(config.MODERATOR_ROLE_ID);

    if (!hasModeratorRole) {
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle("❌ Permission Denied")
        .setDescription(
          "Only moderators can verify payments! You need the moderator role to use this command.",
        )
        .setTimestamp();

      return await interaction.reply({
        embeds: [errorEmbed],
        flags: 64, // MessageFlags.Ephemeral
      });
    }

    const orderId = interaction.options.getString("order_id");
    const status = interaction.options.getString("status");
    const notes =
      interaction.options.getString("notes") || "No additional notes provided.";

    if (!orderId) {
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle("❌ Error")
        .setDescription("Order ID is required!")
        .setTimestamp();

      return await interaction.reply({
        embeds: [errorEmbed],
        flags: 64, // MessageFlags.Ephemeral
      });
    }

    // Get payment data from Google Sheets
    const paymentData = await PaymentSheetService.getPaymentByOrderId(orderId);
    if (!paymentData) {
      const errorEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle("❌ Error")
        .setDescription("Order ID not found!")
        .setTimestamp();

      return await interaction.reply({
        embeds: [errorEmbed],
        flags: 64, // MessageFlags.Ephemeral
      });
    }

    // Update payment status in Google Sheets
    await PaymentSheetService.updatePaymentStatus(
      orderId,
      status as "incomplete" | "complete",
    );

    let statusInfo: string;
    let color: number;
    let emoji: string;

    switch (status) {
      case "complete":
        statusInfo = "Order Complete";
        color = config.EMBED_COLORS.SUCCESS;
        emoji = "✅";
        break;
      case "incomplete":
        statusInfo = "Order Incomplete";
        color = config.EMBED_COLORS.ERROR;
        emoji = "❌";
        break;
      default:
        statusInfo = "Unknown Status";
        color = config.EMBED_COLORS.INFO;
        emoji = "❓";
    }

    const verifyEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} Order Verification`)
      .setDescription(`Order verification for ${paymentData.discordUsername}`)
      .addFields(
        { name: "🆔 Order ID", value: paymentData.orderId, inline: true },
        {
          name: "👤 Discord User",
          value: `${paymentData.discordUsername} (${paymentData.discordUserId})`,
          inline: true,
        },
        {
          name: "🎮 Roblox Username",
          value: paymentData.robloxUsername,
          inline: true,
        },
        {
          name: "💰 Robux Amount",
          value: paymentData.robuxAmount.toString(),
          inline: true,
        },
        {
          name: "💳 Payment Amount",
          value: `Rs.${paymentData.paymentAmount}`,
          inline: true,
        },
        { name: "📊 Status", value: statusInfo, inline: true },
        { name: "👨‍💼 Verified by", value: interaction.user.tag, inline: true },
        { name: "📝 Notes", value: notes, inline: false },
        {
          name: "📅 Verified at",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false,
        },
      )
      .setFooter({ text: "Robux Nepal Order Verification" })
      .setTimestamp();

    await interaction.reply({
      embeds: [verifyEmbed],
    });

    // If complete, send a follow-up message
    if (status === "complete") {
      const successEmbed = new EmbedBuilder()
        .setColor(config.EMBED_COLORS.SUCCESS)
        .setTitle("🎉 Order Completed Successfully!")
        .setDescription(
          `Thanks your order is completed. This ticket will be automatically deleted in 24 hours.`,
        )
        .addFields(
          { name: "🆔 Order ID", value: paymentData.orderId, inline: true },
          {
            name: "🎮 Roblox Username",
            value: paymentData.robloxUsername,
            inline: true,
          },
          {
            name: "💰 Robux Amount",
            value: paymentData.robuxAmount.toString(),
            inline: true,
          },
          {
            name: "👨‍💼 Completed by",
            value: interaction.user.tag,
            inline: true,
          },
          {
            name: "📅 Completed at",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: true,
          },
          {
            name: "🗑️ Auto-delete",
            value: `<t:${Math.floor(Date.now() / 1000) + 86400}:R>`,
            inline: true,
          },
        )
        .setFooter({ text: "Thank you for choosing Robux Nepal!" })
        .setTimestamp();

      await interaction.followUp({
        content: `<@${paymentData.discordUserId}>`,
        embeds: [successEmbed],
      });

      // Schedule ticket deletion after 24 hours (86400000 milliseconds)
      setTimeout(async () => {
        try {
          const channel = interaction.channel;
          if (
            channel &&
            channel.name.startsWith(config.TICKET_CHANNEL_PREFIX)
          ) {
            const deleteEmbed = new EmbedBuilder()
              .setColor(config.EMBED_COLORS.INFO)
              .setTitle("🗑️ Ticket Auto-Deletion")
              .setDescription(
                "This ticket is being automatically deleted as the order was completed 24 hours ago.",
              )
              .addFields(
                {
                  name: "🆔 Order ID",
                  value: paymentData.orderId,
                  inline: true,
                },
                {
                  name: "📅 Completed",
                  value: `<t:${Math.floor(Date.now() / 1000) - 86400}:R>`,
                  inline: true,
                },
              )
              .setFooter({ text: "Robux Nepal Ticket System" })
              .setTimestamp();

            await channel.send({ embeds: [deleteEmbed] });

            // Wait 5 seconds before deleting to show the message
            setTimeout(async () => {
              await channel.delete(
                "Order completed - Auto-deletion after 24 hours",
              );
            }, 5000);
          }
        } catch (error) {
          console.error("Error auto-deleting ticket:", error);
        }
      }, 86400000); // 24 hours in milliseconds
    }
  },
};
