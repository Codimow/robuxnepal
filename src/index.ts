import { Client, GatewayIntentBits, Collection, ClientOptions } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

class MyClient extends Client {
    commands: Collection<string, any>;

    constructor(options: ClientOptions) {
        super(options);
        this.commands = new Collection();
    }
}

const client = new MyClient({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});



// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
    } else {
        console.log(`Failed to load command from ${file}:`, command);
    }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
}

// Add interaction handler for slash commands and modals
client.on('interactionCreate', async (interaction: any) => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }
    
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'ticket_modal') {
            const robloxUsername = interaction.fields.getTextInputValue('roblox_username');
            const robuxAmount = interaction.fields.getTextInputValue('robux_amount');

            // Defer the response to prevent timeout
            await interaction.deferReply({ ephemeral: true });

            try {
                // Import config
                const { config } = require('./utils/config');
                
                // Create private channel for the ticket
                const { ChannelType, PermissionFlagsBits } = require('discord.js');
                
                // Prepare permission overwrites
                const permissionOverwrites = [
                    {
                        id: interaction.guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    }
                ];

                // Add moderator role permissions if configured
                if (config.MODERATOR_ROLE_ID && config.MODERATOR_ROLE_ID !== 'MODERATOR_ROLE_ID') {
                    permissionOverwrites.push({
                        id: config.MODERATOR_ROLE_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageMessages,
                        ],
                    });
                }

                const ticketChannel = await interaction.guild.channels.create({
                    name: `${config.TICKET_CHANNEL_PREFIX}${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    parent: config.TICKET_CATEGORY_ID || undefined,
                    permissionOverwrites: permissionOverwrites,
                });

                // Calculate payment amount (1 Robux = 1 NPR)
                const paymentAmount = parseInt(robuxAmount);
                const paymentMessage = `Please pay Rs.${paymentAmount} in the given QR`;

                // Create embed with user information
                const { EmbedBuilder } = require('discord.js');
                
                const ticketEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.SUCCESS)
                    .setTitle('🎫 New Robux Purchase Ticket')
                    .setDescription(`A new ticket has been created by ${interaction.user}`)
                    .addFields(
                        { name: '👤 User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                        { name: '🎮 Roblox Username', value: robloxUsername, inline: true },
                        { name: '💰 Robux Amount', value: robuxAmount, inline: true },
                        { name: '💳 Payment Amount', value: `Rs.${paymentAmount}`, inline: true },
                        { name: '📱 Payment Instructions', value: paymentMessage, inline: false },
                        { name: '📅 Created', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                    )
                    .setFooter({ text: 'Robux Nepal Ticket System' })
                    .setTimestamp();

                // Add QR code if available
                if (config.QR_CODE_URL) {
                    ticketEmbed.setImage(config.QR_CODE_URL);
                }

                // Send the ticket information to the private channel
                await ticketChannel.send({
                    content: `@everyone New ticket created!`,
                    embeds: [ticketEmbed]
                });

                // Send welcome message with instructions
                const welcomeEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.INFO)
                    .setTitle('📋 Ticket Instructions')
                    .setDescription('Welcome to your ticket! Please follow these instructions:')
                    .addFields(
                        { name: '💳 Payment', value: 'Please make the payment as instructed above', inline: false },
                        { name: '📸 Screenshot', value: 'Send a screenshot of your payment receipt in this channel', inline: false },
                        { name: '⚠️ Important', value: 'Only image files (PNG, JPG, GIF, WebP) are allowed in this channel', inline: false },
                        { name: '⏱️ Response Time', value: 'A moderator will assist you shortly after payment verification', inline: false }
                    )
                    .setFooter({ text: 'Robux Nepal Support Team' })
                    .setTimestamp();

                await ticketChannel.send({ embeds: [welcomeEmbed] });

                // Send confirmation to user with payment info
                const confirmEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.SUCCESS)
                    .setTitle('✅ Ticket Created Successfully!')
                    .setDescription(`Your ticket has been created in ${ticketChannel}`)
                    .addFields(
                        { name: '🎮 Roblox Username', value: robloxUsername, inline: true },
                        { name: '💰 Robux Amount', value: robuxAmount, inline: true },
                        { name: '💳 Payment Amount', value: `Rs.${paymentAmount}`, inline: true },
                        { name: '📱 Payment Instructions', value: paymentMessage, inline: false }
                    )
                    .setFooter({ text: 'A moderator will assist you shortly!' });

                // Add QR code if available
                if (config.QR_CODE_URL) {
                    confirmEmbed.setImage(config.QR_CODE_URL);
                }

                await interaction.editReply({
                    embeds: [confirmEmbed]
                });

            } catch (error) {
                console.error('Error creating ticket:', error);
                
                const { EmbedBuilder } = require('discord.js');
                const { config } = require('./utils/config');
                
                const errorEmbed = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.ERROR)
                    .setTitle('❌ Error Creating Ticket')
                    .setDescription('There was an error creating your ticket. Please try again later or contact an administrator.')
                    .setTimestamp();

                try {
                    await interaction.editReply({
                        embeds: [errorEmbed]
                    });
                } catch (replyError) {
                    console.error('Error sending error message:', replyError);
                    // If we can't edit the reply, try to follow up
                    try {
                        await interaction.followUp({
                            embeds: [errorEmbed],
                            ephemeral: true
                        });
                    } catch (followUpError) {
                        console.error('Error sending follow-up message:', followUpError);
                    }
                }
            }
        }
    }
});

// Handle messages in ticket channels
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if message is in a ticket channel
    const { config } = require('./utils/config');
    if (!message.channel.isTextBased() || !('name' in message.channel) || !message.channel.name.startsWith(config.TICKET_CHANNEL_PREFIX)) return;
    
    // Check if message has attachments
    if (message.attachments.size === 0) {
        // Delete non-image messages
        try {
            await message.delete();
            const { EmbedBuilder } = require('discord.js');
            const warning = new EmbedBuilder()
                .setColor(config.EMBED_COLORS.WARNING)
                .setTitle('⚠️ Invalid Message')
                .setDescription('Only payment screenshots (images) are allowed in this ticket channel.')
                .setFooter({ text: 'Please send only images of your payment receipt.' });
            
            await message.channel.send({ embeds: [warning] });
        } catch (error) {
            console.error('Error handling invalid message:', error);
        }
        return;
    }
    
    // Check if all attachments are images
    const { AttachmentType } = require('discord.js');
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    for (const attachment of message.attachments.values()) {
        if (!attachment.contentType || !validImageTypes.includes(attachment.contentType)) {
            try {
                await message.delete();
                const { EmbedBuilder } = require('discord.js');
                const error = new EmbedBuilder()
                    .setColor(config.EMBED_COLORS.ERROR)
                    .setTitle('❌ Invalid File Type')
                    .setDescription('Only image files (PNG, JPG, GIF, WebP) are allowed for payment screenshots.')
                    .setFooter({ text: 'Please send only image files.' });
                
                await message.channel.send({ embeds: [error] });
            } catch (error) {
                console.error('Error handling invalid file type:', error);
            }
            return;
        }
    }
    
    // If we get here, it's a valid image message
    try {
        const { EmbedBuilder } = require('discord.js');
        const { PaymentSheetService } = require('./utils/sheets');
        
        // Get the first attachment (screenshot)
        const firstAttachment = message.attachments.first();
        if (!firstAttachment) return;
        
        // Generate unique order ID
        const orderId = `RBX-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Extract payment info from channel topic or previous messages
        // For now, we'll get it from the channel name and make some assumptions
        const channelName = message.channel.name;
        const username = channelName.replace('ticket-', '');
        
        // Try to get robux amount from recent messages in the channel
        let robuxAmount = 0;
        try {
            const messages = await message.channel.messages.fetch({ limit: 10 });
            for (const msg of messages.values()) {
                if (msg.embeds.length > 0) {
                    const embed = msg.embeds[0];
                    if (embed.fields) {
                        for (const field of embed.fields) {
                            if (field.name === '💰 Robux Amount') {
                                robuxAmount = parseInt(field.value) || 0;
                                break;
                            }
                        }
                    }
                }
                if (robuxAmount > 0) break;
            }
        } catch (error) {
            console.error('Error fetching messages for robux amount:', error);
        }
        
        // Store payment data
        const paymentData = {
            orderId: orderId,
            robloxUsername: username,
            discordUsername: message.author.tag,
            discordUserId: message.author.id,
            robuxAmount: robuxAmount,
            paymentAmount: robuxAmount, // 1 Robux = 1 NPR
            screenshotUrl: firstAttachment.url,
            timestamp: new Date().toISOString(),
            status: 'incomplete' as const,
            ticketChannelId: message.channel.id
        };
        
        // Save to Google Sheets
        await PaymentSheetService.addPayment(paymentData);
        
        const paymentEmbed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.INFO)
            .setTitle('📸 Payment Screenshot Received')
            .setDescription(`Payment screenshot submitted by ${message.author}`)
            .addFields(
                { name: '🆔 Order ID', value: orderId, inline: true },
                { name: '👤 User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: '📅 Submitted', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '🎮 Roblox Username', value: username, inline: true },
                { name: '💰 Robux Amount', value: robuxAmount.toString(), inline: true },
                { name: '💳 Payment Amount', value: `Rs.${robuxAmount}`, inline: true },
                { name: '📎 Screenshot', value: `[View Image](${firstAttachment.url})`, inline: true },
                { name: '📊 Status', value: '🟡 Incomplete', inline: true },
                { name: '📎 Attachments', value: `${message.attachments.size} image(s)`, inline: true }
            )
            .setFooter({ text: 'Robux Nepal Payment Verification' })
            .setTimestamp();
        
        // Add the first image as embed image
        paymentEmbed.setImage(firstAttachment.url);
        
        // Send confirmation
        await message.channel.send({ embeds: [paymentEmbed] });
        
        // Add reaction to original message
        await message.react('✅');
        
    } catch (error) {
        console.error('Error processing payment screenshot:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);