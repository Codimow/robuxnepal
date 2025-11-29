import { Client } from "discord.js";
import { logger } from "../utils/logger";
import { checkAndDeleteCompletedTickets } from "../utils/cleanup";

export = {
    name: "ready", // Changed from clientReady to ready to match discord.js event name
    once: true,
    execute(client: Client) {
        logger.info(`✅ Bot is ready! Logged in as ${client.user?.tag}`);
        logger.info(`📊 Serving ${client.guilds.cache.size} guild(s)`);

        // Run cleanup immediately
        checkAndDeleteCompletedTickets(client);

        // Run cleanup every hour
        setInterval(() => {
            checkAndDeleteCompletedTickets(client);
        }, 60 * 60 * 1000);
    },
};
