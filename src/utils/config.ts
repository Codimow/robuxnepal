// Configuration file for the Robux Nepal Discord Bot
export const config = {
    // Moderator role ID from environment variable
    MODERATOR_ROLE_ID: process.env.MODERATOR_ROLE_ID || 'MODERATOR_ROLE_ID',
    
    // Category ID for tickets from environment variable (optional)
    TICKET_CATEGORY_ID: process.env.TICKET_CATEGORY_ID || null,
    
    // QR Code URL for payments
    QR_CODE_URL: process.env.QR_CODE_URL || null,
    
    // Google Sheets configuration
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || null,
    
    // Ticket channel settings
    TICKET_CHANNEL_PREFIX: 'ticket-',
    
    // Auto-delete delay (in milliseconds) after closing ticket
    AUTO_DELETE_DELAY: 5000,
    
    // Bot settings
    EMBED_COLORS: {
        SUCCESS: 0x00ff00,
        ERROR: 0xff0000,
        INFO: 0x0099ff,
        WARNING: 0xffaa00
    }
};
