import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../utils/config';

export = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket'),
    async execute(interaction: any) {
        // Check if the command is being used in a ticket channel
        if (!interaction.channel.name.startsWith(config.TICKET_CHANNEL_PREFIX)) {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle('❌ Error')
                .setDescription('This command can only be used in ticket channels!')
                .setTimestamp();

            return await interaction.reply({
                embeds: [errorEmbed],
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Check if user has permission to close tickets (moderators or ticket creator)
        const isModerator = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
        const isTicketCreator = interaction.channel.name.includes(interaction.user.username);

        if (!isModerator && !isTicketCreator) {
            const errorEmbed = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.ERROR)
                .setTitle('❌ Permission Denied')
                .setDescription('You do not have permission to close this ticket!')
                .setTimestamp();

            return await interaction.reply({
                embeds: [errorEmbed],
                flags: 64 // MessageFlags.Ephemeral
            });
        }

        // Create closing embed
        const closeEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.ERROR)
            .setTitle('🔒 Ticket Closed')
            .setDescription(`This ticket has been closed by ${interaction.user}`)
            .addFields(
                { name: '👤 Closed by', value: `${interaction.user.tag}`, inline: true },
                { name: '📅 Closed at', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'Robux Nepal Ticket System' })
            .setTimestamp();

        await interaction.reply({
            embeds: [closeEmbed]
        });

        // Delete the channel after configured delay
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, config.AUTO_CLOSE_DELAY_MS);
    },
};
