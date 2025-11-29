import { Client, EmbedBuilder } from "discord.js";
import { PaymentSheetService } from "./sheets";
import { config } from "./config";
import { logger } from "./logger";

export async function checkAndDeleteCompletedTickets(client: Client) {
    try {
        const paymentsToDelete =
            await PaymentSheetService.getCompletedPaymentsForDeletion();

        for (const payment of paymentsToDelete) {
            try {
                // Find the guild and channel
                const guilds = client.guilds.cache;
                for (const guild of guilds.values()) {
                    if (!payment.ticketChannelId) continue;
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
                                logger.info(
                                    `Deleted ticket channel for order ${payment.orderId}`,
                                );
                            } catch (err) {
                                logger.error(
                                    `Error deleting channel for order ${payment.orderId}`,
                                    err,
                                );
                            }
                        }, 5000);
                    }
                }
            } catch (error) {
                logger.error(
                    `Error processing deletion for order ${payment.orderId}`,
                    error,
                );
            }
        }
    } catch (error) {
        logger.error("Error checking for completed tickets", error);
    }
}
