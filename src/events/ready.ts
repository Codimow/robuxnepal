import { Client } from "discord.js";
import { logger } from "../utils/logger";

export = {
    name: "clientReady",
    once: true,
    execute(client: Client) {
        logger.info(`✅ Bot is ready! Logged in as ${client.user?.tag}`);
        logger.info(`📊 Serving ${client.guilds.cache.size} guild(s)`);
    },
};
