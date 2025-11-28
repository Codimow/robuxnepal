/**
 * Centralized error handling utilities
 */

import { logger } from "./logger";
import { EmbedBuilder } from "discord.js";
import { config } from "./config";

export class BotError extends Error {
    public readonly isOperational: boolean;

    constructor(message: string, isOperational: boolean = true) {
        super(message);
        this.name = "BotError";
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class DiscordAPIError extends BotError {
    constructor(message: string) {
        super(message, true);
        this.name = "DiscordAPIError";
    }
}

export class GoogleSheetsError extends BotError {
    constructor(message: string) {
        super(message, true);
        this.name = "GoogleSheetsError";
    }
}

export class ValidationError extends BotError {
    constructor(message: string) {
        super(message, true);
        this.name = "ValidationError";
    }
}

/**
 * Convert error to user-friendly message
 */
export function getUserFriendlyError(error: unknown): string {
    if (error instanceof ValidationError) {
        return error.message;
    }

    if (error instanceof DiscordAPIError) {
        return "Discord service is experiencing issues. Please try again later.";
    }

    if (error instanceof GoogleSheetsError) {
        return "Failed to save data. Please contact an administrator.";
    }

    if (error instanceof Error) {
        // Check for common Discord.js errors
        if (error.message.includes("Missing Permissions")) {
            return "I don't have the required permissions to perform this action.";
        }
        if (error.message.includes("Unknown Channel")) {
            return "The ticket channel no longer exists.";
        }
        if (error.message.includes("Unknown Message")) {
            return "The message no longer exists.";
        }
    }

    return "An unexpected error occurred. Please try again or contact support.";
}

/**
 * Create error embed for Discord
 */
export function createErrorEmbed(
    title: string,
    description: string,
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(config.EMBED_COLORS.ERROR)
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: "If this persists, contact an administrator" });
}

/**
 * Log and return user-friendly error
 */
export function handleError(
    error: unknown,
    context: string,
): { message: string; embed: EmbedBuilder } {
    // Log the full error
    logger.error(`Error in ${context}:`, error);

    // Get user-friendly message
    const userMessage = getUserFriendlyError(error);

    // Create embed
    const embed = createErrorEmbed("Error", userMessage);

    return { message: userMessage, embed };
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000,
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} failed`, error);

            if (attempt < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: unknown): boolean {
    if (error instanceof BotError) {
        return error.isOperational;
    }
    return false;
}
