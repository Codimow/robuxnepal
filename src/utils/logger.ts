/**
 * Centralized logging utility for the bot
 * Provides structured logging with different levels
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

class Logger {
    private level: LogLevel;

    constructor() {
        // Set log level based on environment
        const env = process.env.NODE_ENV || "development";
        this.level = env === "production" ? LogLevel.INFO : LogLevel.DEBUG;
    }

    private log(level: LogLevel, message: string, data?: any): void {
        if (level < this.level) return;

        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level];
        const prefix = `[${timestamp}] [${levelName}]`;

        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    debug(message: string, data?: any): void {
        this.log(LogLevel.DEBUG, message, data);
    }

    info(message: string, data?: any): void {
        this.log(LogLevel.INFO, message, data);
    }

    warn(message: string, data?: any): void {
        this.log(LogLevel.WARN, message, data);
    }

    error(message: string, error?: any): void {
        if (error instanceof Error) {
            this.log(LogLevel.ERROR, message, {
                message: error.message,
                stack: error.stack,
            });
        } else {
            this.log(LogLevel.ERROR, message, error);
        }
    }

    // Log successful operations
    success(message: string, data?: any): void {
        this.info(`✅ ${message}`, data);
    }
}

// Export singleton instance
export const logger = new Logger();
