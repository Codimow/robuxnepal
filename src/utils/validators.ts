/**
 * Input validation utilities for the bot
 */

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

/**
 * Validate Roblox username
 * Rules: 3-20 characters, alphanumeric and underscores only
 */
export function validateRobloxUsername(username: string): {
    valid: boolean;
    error?: string;
} {
    if (!username || typeof username !== "string") {
        return { valid: false, error: "Username is required" };
    }

    const trimmed = username.trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
        return {
            valid: false,
            error: "Username must be between 3 and 20 characters",
        };
    }

    // Roblox usernames: alphanumeric and underscores only
    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(trimmed)) {
        return {
            valid: false,
            error: "Username can only contain letters, numbers, and underscores",
        };
    }

    return { valid: true };
}

/**
 * Validate robux amount
 */
export function validateRobuxAmount(
    amount: number | string,
    min: number = 1,
    max: number = 1000000,
): { valid: boolean; error?: string; value?: number } {
    let numAmount: number;

    if (typeof amount === "string") {
        numAmount = parseInt(amount, 10);
    } else {
        numAmount = amount;
    }

    if (isNaN(numAmount)) {
        return { valid: false, error: "Amount must be a valid number" };
    }

    if (!Number.isInteger(numAmount)) {
        return { valid: false, error: "Amount must be a whole number" };
    }

    if (numAmount < min) {
        return {
            valid: false,
            error: `Amount must be at least ${min} Robux`,
        };
    }

    if (numAmount > max) {
        return {
            valid: false,
            error: `Amount cannot exceed ${max} Robux`,
        };
    }

    return { valid: true, value: numAmount };
}

/**
 * Validate order ID format
 */
export function validateOrderId(orderId: string): boolean {
    if (!orderId || typeof orderId !== "string") return false;
    return /^RN-[A-Z0-9]+-[A-Z0-9]+$/.test(orderId);
}

/**
 * Sanitize text input to prevent issues
 */
export function sanitizeInput(input: string, maxLength: number = 500): string {
    if (!input || typeof input !== "string") return "";

    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[<>]/g, ""); // Remove potential HTML/markdown issues
}

/**
 * Validate Discord user ID format
 */
export function validateDiscordId(id: string): boolean {
    if (!id || typeof id !== "string") return false;
    // Discord IDs are snowflakes (15-20 digits)
    return /^\d{15,20}$/.test(id);
}
