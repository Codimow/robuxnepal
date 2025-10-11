import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export = {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('List all available commands'),
    async execute(interaction: any) {
        const commands = [
            { name: '/ping', description: 'Test if the bot is working' },
            { name: '/ticket', description: 'Create a new Robux purchase ticket' },
            { name: '/close', description: 'Close the current ticket' },
            { name: '/verify', description: 'Verify payment and complete the ticket (Moderators Only)' },
            { name: '/commands', description: 'List all available commands' }
        ];

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🤖 Available Commands')
            .setDescription('Here are all the commands you can use:')
            .addFields(
                commands.map(cmd => ({
                    name: cmd.name,
                    value: cmd.description,
                    inline: false
                }))
            )
            .setFooter({ text: 'Robux Nepal Bot' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
