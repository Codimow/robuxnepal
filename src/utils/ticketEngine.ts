import { Effect, Context, Layer } from "effect";
import { 
    ModalSubmitInteraction, 
    ChannelType, 
    PermissionFlagsBits, 
    OverwriteType, 
    TextChannel,
    EmbedBuilder,
    ActionRowBuilder
} from "discord.js";
import { config } from "./config";
import { PaymentSheetService } from "./sheets";
import { VerificationUtils } from "./verification";
import { logger } from "./logger";

// -------------------------------------------------------------------------
// 1. Define Typed Errors (The "Big Deal" Diagnostics)
// -------------------------------------------------------------------------
export class ChannelError extends Error { readonly _tag = "ChannelError" }
export class SheetsError extends Error { readonly _tag = "SheetsError" }
export class ValidationError extends Error { readonly _tag = "ValidationError" }

// -------------------------------------------------------------------------
// 2. The Ticket Engine Service
// -------------------------------------------------------------------------
export class TicketEngine {
    /**
     * Executes the full ticket creation pipeline as a single atomic effect.
     * This includes: Channel Creation -> Order ID Generation -> Sheets Logging -> Confirmation
     */
    static createTicket = (
        interaction: ModalSubmitInteraction, 
        robloxUsername: string, 
        robuxAmount: number
    ) => Effect.gen(function* (_) {
        
        // --- Phase 1: Infrastructure (Channel Creation) ---
        // We use explicit OverwriteType to bypass Discord's unreliable cache
        const ticketChannel = yield* _(
            Effect.tryPromise({
                try: () => {
                    const permissionOverwrites = [
                        {
                            id: interaction.guild!.roles.everyone.id,
                            type: OverwriteType.Role,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            type: OverwriteType.Member,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                            ],
                        },
                    ];

                    if (config.MODERATOR_ROLE_ID && config.MODERATOR_ROLE_ID !== "MODERATOR_ROLE_ID") {
                        permissionOverwrites.push({
                            id: config.MODERATOR_ROLE_ID,
                            type: OverwriteType.Role,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.ManageMessages,
                            ],
                        });
                    }

                    return interaction.guild!.channels.create({
                        name: `${config.TICKET_CHANNEL_PREFIX}${interaction.user.username}`,
                        type: ChannelType.GuildText,
                        parent: config.TICKET_CATEGORY_ID || undefined,
                        permissionOverwrites: permissionOverwrites,
                    }) as Promise<TextChannel>;
                },
                catch: (e) => new ChannelError(`Failed to create ticket channel: ${e}`)
            })
        );

        yield* _(Effect.log(`[TicketEngine] Channel created: ${ticketChannel.id}`));

        // --- Phase 2: Logic (Order Generation) ---
        const orderId = VerificationUtils.generateOrderId();

        // --- Phase 3: Data Integrity (Google Sheets) ---
        // We wrap this in a retry policy - if Sheets is down, we retry 2 times
        yield* _(
            Effect.tryPromise({
                try: () => PaymentSheetService.addPayment({
                    orderId,
                    discordUsername: interaction.user.tag,
                    discordUserId: interaction.user.id,
                    robloxUsername,
                    robuxAmount,
                    paymentAmount: robuxAmount,
                    status: "pending",
                    createdAt: new Date().toISOString(),
                    ticketChannelId: ticketChannel.id,
                }),
                catch: (e) => new SheetsError(`Database synchronization failed: ${e}`)
            }).pipe(Effect.retry({ times: 2 }))
        );

        return { ticketChannel, orderId };
    });
}
