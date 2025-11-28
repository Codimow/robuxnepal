/**
 * Configuration file for the Robux Nepal Discord Bot
 * Validates environment variables and provides type-safe config
 */

import { logger } from "./logger";

export interface BotConfig {
    MODERATOR_ROLE_ID: string;
    TICKET_CATEGORY_ID: string | null;
    QR_CODE_URL: string | null;
    GOOGLE_SHEET_ID: string;
    TICKET_CHANNEL_PREFIX: string;
    AUTO_CLOSE_DELAY_MS: number;
    TICKET_TIMEOUT_HOURS: number;
    ROBUX_MIN: number;
    ROBUX_MAX: number;
    EMBED_COLORS: {
        SUCCESS: number;
        ERROR: number;
        INFO: number;
        WARNING: number;
    };
}

/**
 * Validate required environment variables
 */
function validateEnv(): void {
    const required = [
        "DISCORD_TOKEN",
        "GOOGLE_CLIENT_EMAIL",
        "GOOGLE_PRIVATE_KEY",
        "GOOGLE_SHEET_ID",
        "MODERATOR_ROLE_ID",
    ];

    const missing: string[] = [];

    for (const key of required) {
        if (!process.env[key]) {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        logger.error(
            `Missing required environment variables: ${missing.join(", ")}`,
        );
        logger.error("Please check your .env file and ensure all required variables are set");
        throw new Error(`Missing environment variables: ${missing.join(", ")}`);
    }

    // Validate MODERATOR_ROLE_ID is not the placeholder
    if (process.env.MODERATOR_ROLE_ID === "MODERATOR_ROLE_ID") {
        logger.error("MODERATOR_ROLE_ID is set to placeholder value");
        throw new Error("Please set a valid MODERATOR_ROLE_ID in your .env file");
    }

    logger.info("✅ All required environment variables are present");
}

/**
 * Load and validate configuration
 */
function loadConfig(): BotConfig {
    validateEnv();

    return {
        // Required settings
        MODERATOR_ROLE_ID: process.env.MODERATOR_ROLE_ID!,
        GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID!,

        // Optional settings
        TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || null,
        QR_CODE_URL: process.env.QR_CODE_URL || null,

        // Ticket settings
        TICKET_CHANNEL_PREFIX: "ticket-",
        AUTO_CLOSE_DELAY_MS: 30000, // 30 seconds
        TICKET_TIMEOUT_HOURS: 24, // Auto-delete if inactive for 24 hours

        // Robux limits
        ROBUX_MIN: 1,
        ROBUX_MAX: 1000000,

        // Embed colors
        EMBED_COLORS: {
            SUCCESS: 0x00ff00, // Green
            ERROR: 0xff0000, // Red
            INFO: 0x0099ff, // Blue
            WARNING: 0xffaa00, // Orange
        },
    };
}

// Export validated config
export const config: BotConfig = loadConfig();
