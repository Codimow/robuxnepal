import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';

export = {
    data: new SlashCommandBuilder()
        .setName('ticketsetup')
        .setDescription('Setup a ticket button for users to create tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction: any) {
        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎫 Robux Nepal Ticket System')
            .setDescription('Click the button below to create a ticket for Robux purchase.')
            .addFields(
                { name: '📋 What to do?', value: 'Click the "Create Ticket" button to start your Robux purchase process.', inline: false },
                { name: '⚡ Fast Support', value: 'Our moderators will assist you shortly after ticket creation.', inline: false },
                { name: '💳 Payment', value: 'Payment instructions will be provided in your ticket channel.', inline: false }
            )
            .setFooter({ text: 'Robux Nepal Support System' })
            .setTimestamp();

        // Create button
        const button = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫');

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(button);

        // Send the message with the button
        await interaction.reply({ content: 'Ticket system setup successfully!', ephemeral: true });

        const channel = await interaction.client.channels.fetch(interaction.channelId) as TextChannel;
        if (channel) {
            await channel.send({
                embeds: [embed],
                components: [row]
            });
        }
    },
};
