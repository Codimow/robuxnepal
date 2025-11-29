import { Message, EmbedBuilder, TextChannel } from "discord.js";
import { config } from "../utils/config";
import { logger } from "../utils/logger";
import { PaymentSheetService } from "../utils/sheets";

export = {
    name: "messageCreate",
    async execute(message: Message) {
        // Ignore bot messages
        if (message.author.bot) return;

        // Check if message is in a ticket channel
        if (
            !message.channel.isTextBased() ||
            message.channel.isDMBased() ||
            !message.channel.name ||
            !message.channel.name.startsWith(config.TICKET_CHANNEL_PREFIX)
        )
            return;

        // Cast to TextChannel since we verified it's text-based and not DM
        const channel = message.channel as TextChannel;

        // Check if message has attachments
        if (message.attachments.size === 0) {
            // Delete non-image messages
            try {
                await message.delete();
                const warning = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.WARNING)
                    .setTitle("⚠️ Invalid Message")
                    .setDescription(
                        "Only payment screenshots (images) are allowed in this ticket channel.",
                    )
                    .setFooter({
                        text: "Please send only images of your payment receipt.",
                    });

                await channel.send({ embeds: [warning] });
            } catch (error) {
                logger.error("Error handling invalid message", error);
            }
            return;
        }

        // Check if all attachments are images
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
                    const error = new EmbedBuilder()
                        .setColor(config.EMBED_COLORS.ERROR)
                        .setTitle("❌ Invalid File Type")
                        .setDescription(
                            "Only image files (PNG, JPG, GIF, WebP) are allowed for payment screenshots.",
                        )
                        .setFooter({ text: "Please send only image files." });

                    await channel.send({ embeds: [error] });
                } catch (error) {
                    logger.error("Error handling invalid file type", error);
                }
                return;
            }
        }

        // If we get here, it's a valid image message
        try {
            // Get the first attachment (screenshot)
            const firstAttachment = message.attachments.first();
            if (!firstAttachment) return;

            // Check if payment already exists for this channel
            let paymentData = await PaymentSheetService.getPaymentByChannelId(
                channel.id,
            );
            let orderId = "";
            let robuxAmount = 0;
            let robloxUsername = "Unknown";

            if (paymentData) {
                // Payment exists, update it
                orderId = paymentData.orderId;
                robuxAmount = paymentData.robuxAmount;
                robloxUsername = paymentData.robloxUsername;

                // Update screenshot URL
                await PaymentSheetService.updatePaymentScreenshot(
                    orderId,
                    firstAttachment.url,
                );

                // Update status to incomplete if it was pending
                if (paymentData.status === "pending") {
                    await PaymentSheetService.updatePaymentStatus(orderId, "incomplete");
                }
            } else {
                // Payment doesn't exist (fallback logic)
                // Generate unique order ID
                orderId = `RBX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

                // Extract payment info from channel topic or previous messages
                try {
                    const messages = await channel.messages.fetch({ limit: 10 });
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
                    logger.error("Error fetching messages for ticket info", error);
                }

                // Store payment data
                const newPaymentData = {
                    orderId: orderId,
                    robloxUsername: robloxUsername,
                    discordUsername: message.author.tag,
                    discordUserId: message.author.id,
                    robuxAmount: robuxAmount,
                    paymentAmount: robuxAmount, // 1 Robux = 1 NPR
                    screenshotUrl: firstAttachment.url,
                    createdAt: new Date().toISOString(),
                    status: "incomplete" as const,
                    ticketChannelId: channel.id,
                };

                // Save to Google Sheets
                await PaymentSheetService.addPayment(newPaymentData);
            }

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
            await channel.send({ embeds: [paymentEmbed] });

            // Add reaction to original message
            await message.react("✅");
        } catch (error) {
            logger.error("Error processing payment screenshot", error);
        }
    },
};
