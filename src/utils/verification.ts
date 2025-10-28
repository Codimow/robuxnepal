import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ModalSubmitInteraction,
  Collection,
} from "discord.js";
import { config } from "./config";
import { PaymentSheetService } from "./sheets";

export interface VerificationData {
  orderId: string;
  status: "complete" | "incomplete";
  notes: string;
  verifiedBy: string;
  verifiedAt: number;
}

export class VerificationUtils {
  /**
   * Check if a user has moderator permissions
   */
  static hasModeratorPermission(
    interaction: ButtonInteraction | ModalSubmitInteraction,
  ): boolean {
    if (
      !config.MODERATOR_ROLE_ID ||
      config.MODERATOR_ROLE_ID === "MODERATOR_ROLE_ID"
    ) {
      return false;
    }

    // Check if member has moderator role
    const memberRoles = interaction.member?.roles;
    if (memberRoles && "cache" in memberRoles) {
      return memberRoles.cache.has(config.MODERATOR_ROLE_ID);
    }

    // Fallback for array-based roles
    return (
      Array.isArray(memberRoles) &&
      memberRoles.includes(config.MODERATOR_ROLE_ID)
    );
  }

  /**
   * Generate a unique order ID
   */
  static generateOrderId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RN-${timestamp}-${randomStr}`;
  }

  /**
   * Create verification buttons for ticket messages
   */
  static createVerificationButtons(
    orderId: string,
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`verify_payment_${orderId}`)
        .setLabel("🔍 Detailed Verify")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔍"),
      new ButtonBuilder()
        .setCustomId(`quick_verify_${orderId}_complete`)
        .setLabel("✅ Quick Complete")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅"),
      new ButtonBuilder()
        .setCustomId(`quick_verify_${orderId}_incomplete`)
        .setLabel("❌ Quick Reject")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("❌"),
    );
  }

  /**
   * Create final verification buttons for modal submission
   */
  static createFinalVerificationButtons(
    orderId: string,
  ): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`final_verify_${orderId}_complete`)
        .setLabel("✅ Complete Order")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`final_verify_${orderId}_incomplete`)
        .setLabel("❌ Mark Incomplete")
        .setStyle(ButtonStyle.Danger),
    );
  }

  /**
   * Create verification embed for displaying order details
   */
  static createVerificationEmbed(
    orderId: string,
    notes?: string,
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(config.EMBED_COLORS.INFO)
      .setTitle("🔍 Payment Verification")
      .setDescription(
        `Please select the verification status for Order ID: **${orderId}**`,
      )
      .addFields(
        notes
          ? { name: "📝 Notes", value: notes, inline: false }
          : {
              name: "📝 Notes",
              value: "No additional notes provided",
              inline: false,
            },
      )
      .setTimestamp();
  }

  /**
   * Process verification and update payment status
   */
  static async processVerification(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    orderId: string,
    status: "complete" | "incomplete",
    notes: string,
  ): Promise<void> {
    // Get payment data
    const paymentData = await PaymentSheetService.getPaymentByOrderId(orderId);
    if (!paymentData) {
      throw new Error("Payment data not found");
    }

    // Update payment status in sheets
    await PaymentSheetService.updatePaymentStatus(orderId, status);

    // Create verification result embed
    const verificationEmbed = this.createVerificationResultEmbed(
      paymentData,
      status,
      interaction.user.tag,
      notes,
    );

    // Send verification message to channel
    if (interaction.channel && "send" in interaction.channel) {
      await interaction.channel.send({ embeds: [verificationEmbed] });
    }

    // Handle completion if order is complete
    if (status === "complete") {
      await this.handleOrderCompletion(interaction, paymentData);
    }
  }

  /**
   * Create verification result embed
   */
  static createVerificationResultEmbed(
    paymentData: any,
    status: "complete" | "incomplete",
    verifiedBy: string,
    notes: string,
  ): EmbedBuilder {
    const statusInfo =
      status === "complete" ? "Order Complete" : "Order Incomplete";
    const color =
      status === "complete"
        ? config.EMBED_COLORS.SUCCESS
        : config.EMBED_COLORS.ERROR;
    const emoji = status === "complete" ? "✅" : "❌";

    return new EmbedBuilder()
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
        { name: "👨‍💼 Verified by", value: verifiedBy, inline: true },
        { name: "📝 Notes", value: notes, inline: false },
        {
          name: "📅 Verified at",
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: false,
        },
      )
      .setFooter({ text: "Robux Nepal Order Verification" })
      .setTimestamp();
  }

  /**
   * Handle order completion - send success message and schedule deletion
   */
  static async handleOrderCompletion(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    paymentData: any,
  ): Promise<void> {
    const successEmbed = new EmbedBuilder()
      .setColor(config.EMBED_COLORS.SUCCESS)
      .setTitle("🎉 Order Completed Successfully!")
      .setDescription(
        "Thanks! Your order is completed. This ticket will be automatically deleted in 24 hours.",
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
        { name: "👨‍💼 Completed by", value: interaction.user.tag, inline: true },
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

    // Send completion message with user mention
    if (interaction.channel && "send" in interaction.channel) {
      await interaction.channel.send({
        content: `<@${paymentData.discordUserId}>`,
        embeds: [successEmbed],
      });
    }

    // Schedule auto-deletion after 24 hours
    this.scheduleTicketDeletion(interaction, paymentData, 86400000); // 24 hours in milliseconds
  }

  /**
   * Schedule ticket deletion after completion
   */
  static scheduleTicketDeletion(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    paymentData: any,
    delay: number,
  ): void {
    setTimeout(async () => {
      try {
        if (!interaction.channel) return;

        const deleteEmbed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.INFO)
          .setTitle("🗑️ Ticket Auto-Deletion")
          .setDescription(
            "This ticket is being automatically deleted as the order was completed 24 hours ago.",
          )
          .addFields(
            { name: "🆔 Order ID", value: paymentData.orderId, inline: true },
            {
              name: "📅 Completed",
              value: `<t:${Math.floor(Date.now() / 1000) - 86400}:R>`,
              inline: true,
            },
          )
          .setFooter({ text: "Robux Nepal Ticket System" })
          .setTimestamp();

        if (interaction.channel && "send" in interaction.channel) {
          await interaction.channel.send({ embeds: [deleteEmbed] });
        }

        // Wait 5 seconds before deleting to show the message
        setTimeout(async () => {
          if (interaction.channel && "delete" in interaction.channel) {
            await interaction.channel.delete(
              "Order completed - Auto-deletion after 24 hours",
            );
          }
        }, 5000);
      } catch (error) {
        console.error("Error auto-deleting ticket:", error);
      }
    }, delay);
  }

  /**
   * Create permission denied embed
   */
  static createPermissionDeniedEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(config.EMBED_COLORS.ERROR)
      .setTitle("❌ Permission Denied")
      .setDescription(
        "Only moderators can verify payments! You need the moderator role to use this command.",
      )
      .setTimestamp();
  }

  /**
   * Create error embed for verification failures
   */
  static createVerificationErrorEmbed(message: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(config.EMBED_COLORS.ERROR)
      .setTitle("❌ Verification Error")
      .setDescription(message)
      .setTimestamp();
  }

  /**
   * Create success embed for verification completion
   */
  static createVerificationSuccessEmbed(
    orderId: string,
    status: string,
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(config.EMBED_COLORS.SUCCESS)
      .setTitle("✅ Verification Complete")
      .setDescription(
        `Order ${orderId} has been ${status === "complete" ? "completed" : "marked as incomplete"}.`,
      )
      .setTimestamp();
  }

  /**
   * Create timeout embed for verification timeouts
   */
  static createVerificationTimeoutEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(config.EMBED_COLORS.WARNING)
      .setTitle("⏰ Verification Timeout")
      .setDescription("Verification timed out. Please try again.")
      .setTimestamp();
  }

  /**
   * Validate order ID format
   */
  static isValidOrderId(orderId: string): boolean {
    const orderIdRegex = /^RN-[A-Z0-9]+-[A-Z0-9]+$/;
    return orderIdRegex.test(orderId);
  }

  /**
   * Extract order ID from button custom ID
   */
  static extractOrderIdFromCustomId(customId: string): string | null {
    const parts = customId.split("_");
    return parts.length >= 3 ? parts[2] : null;
  }

  /**
   * Extract status from button custom ID
   */
  static extractStatusFromCustomId(
    customId: string,
  ): "complete" | "incomplete" | null {
    const parts = customId.split("_");
    const status = parts[parts.length - 1];
    return status === "complete" || status === "incomplete" ? status : null;
  }
}
