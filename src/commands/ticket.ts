import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a ticket for Robux purchase'),
    async execute(interaction: any) {
        // Create modal for user input
        const modal = new ModalBuilder()
            .setCustomId('ticket_modal')
            .setTitle('Robux Purchase Ticket');

        // Roblox Username input
        const usernameInput = new TextInputBuilder()
            .setCustomId('roblox_username')
            .setLabel('Your Roblox Username')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your Roblox username...')
            .setRequired(true)
            .setMaxLength(20);

        // Robux Amount input
        const robuxInput = new TextInputBuilder()
            .setCustomId('robux_amount')
            .setLabel('Amount of Robux')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the amount of Robux you want...')
            .setRequired(true)
            .setMaxLength(10);

        // Add inputs to action rows
        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(usernameInput);
        const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(robuxInput);

        // Add action rows to modal
        modal.addComponents(firstActionRow, secondActionRow);

        // Show the modal
        await interaction.showModal(modal);
    },
};
