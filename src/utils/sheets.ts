import { google } from 'googleapis';
import { config } from './config';

// Service account credentials
const serviceAccountKey = {
    "type": "service_account",
    "project_id": "top-chain-473614-t8",
    "private_key_id": "6081e9010d8814711a5eea3b1bfd00adac8b183a",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCnGmwSVFeSli1f\n03CL/u5QY57Nn3ONLjV7CPsHU2mG3WuZMvvpxUk6OUsOH9Ru4JidG4sDk8pUp4pf\njiwIsKEvKxcy8hIEgsGQCZmaXVa9Ut2VBFpZ/9e3hF+onYiHAuc05PcJZhMK8QhN\nkTK8mFZBXtKnPXTr5lfp7Vje7fXnNIvcJ3525wGcP+ZYFaIUVwbhfElqgNF3VfQC\nxLwX3jqv+Zm0iO7/JybYQe+2TP5SbflojekEWj4yQ4eo8hRAdX5DnUtoxxMo9r3+\n9uvHO8jkVurZFVC4HzqLdROGrffWnKi76n6T5CoJfOVTRk+CR1QmgL4ynNkCsjVF\nkYL/898FAgMBAAECggEAG4uEcwUKJnSw6BHfhIQyXnf9bmGxV31dfXl+f7elNoD7\nQpaf5eoKZxmYoKxohRpqrcMjiCRtfsTbT2MNKSWMfEz7Fv/GLo4rQAYFFuf5611k\nfzLnfdxpf6vHZPEK106INDTl79uumegfeUHM/j+SQFZUHRNJWbVvmnTwaFcLaOAA\nyVa0J4jRwmRqaJFkGPuVw6Q63wpMPIcvt5vrc59jDLXxGBLOeJuuAwU6x9+V2I/u\neKuJMFt7a6rHvZcdV/UevYFwI8fjns61246w9euJ8jCYX4oZzaxqO7Ief4nJ6WlS\nXIvqwjjbiH34q2ju617ayzv+P0Q5RcFO0/a+P7EA4QKBgQDrNxkxOcc9hgSczBik\n6lKOFq+RQQ46SCMx8A/WqZK8ssEZjzQT3FK2a966+yEIbSHNPFaUo6XCj174T2dW\nYOX3WYeTOXrWfsr0yLnk25uIRVmbSTgPrRJviuo+7ENRbmTTOGLeI09pNEAH/Kz8\nDI0pwf5jeV8HowsaavDIjeHsuQKBgQC13oiRMkuNINHvQt0Zu+eLLQAtaKrjbBDv\nvgWPTXprkvyZT9KgnjeYz3WflDqKeSAeagSfAKUJpkzplGKl0anEUo+sWs4Wcs6F\npSC+fM5w+DhTtK2pgWNibJGys2L2JKbueFB//r/LA7IjSHwflGWKDkfJkpSPbNCJ\nj36TYecWrQKBgQCijSpYzZA2oWaQoa+qUNGKpnzgii/18SJ5gWjAteHVjEdMjZ20\n1/9FWFjNqX2ToC/K8Rb4k/ua8I/2VJGarU5f2TyLbx7IG0nRTuLBGU9sJlkdqsUW\neEoUUdE+ePKw1PTSz9XrpEVd9CEIJAO8EESCBjHyts8IrRGgSSVrxDnM6QKBgADk\nCyUy6t3RGFYkrLKQkgzDdqnCRnwAroCOHLbb+UqHmMcjdfOlcr5D3d6fOj4tY7Pi\nbw1cUnKepufJ+0W2pi84/E0q0LGZdFuBOIzWTaiN/rCiROt8n8D+qSQH7ucnvM2U\nN0i5NbVH2lqD41/AOVMYyM868ZFWRhs2YbdVFm2tAoGAWNbMcaHJ8EsR6yv/Ys+c\n9vWO9S4Cx7BDCNlZvdpvldHqnLRTloDciAu4wFD61MfX1t+POV78W+RbfaPQJIOp\nz7EmLMdqVteC2JKgLbZb3xkJRGXb+WAbUiXre0jLgk0VNrRhOuUwjVeLs0nvjZX3\nX/uRMRC20Hkq9Bd4xvIqMYc=\n-----END PRIVATE KEY-----\n",
    "client_email": "robux-958@top-chain-473614-t8.iam.gserviceaccount.com",
    "client_id": "104167989804273147328",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/robux-958%40top-chain-473614-t8.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
    credentials: serviceAccountKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Get Google Sheet ID from config
const SPREADSHEET_ID = config.GOOGLE_SHEET_ID || 'your_sheet_id_here';

export interface PaymentData {
    robloxUsername: string;
    discordUsername: string;
    discordUserId: string;
    robuxAmount: number;
    paymentAmount: number;
    screenshotUrl: string;
    timestamp: string;
    status: 'incomplete' | 'complete';
    ticketChannelId: string;
    orderId: string;
}

export class PaymentSheetService {
    // Add payment data to the sheet
    static async addPayment(paymentData: PaymentData): Promise<void> {
        try {
            const values = [
                [
                    paymentData.orderId,
                    paymentData.robloxUsername,
                    paymentData.discordUsername,
                    paymentData.discordUserId,
                    paymentData.robuxAmount,
                    paymentData.paymentAmount,
                    paymentData.screenshotUrl,
                    paymentData.timestamp,
                    paymentData.status,
                    paymentData.ticketChannelId
                ]
            ];

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A:J',
                valueInputOption: 'RAW',
                requestBody: {
                    values: values
                }
            });

            console.log('Payment data added to sheet successfully');
        } catch (error) {
            console.error('Error adding payment to sheet:', error);
            throw error;
        }
    }

    // Update payment status
    static async updatePaymentStatus(orderId: string, status: 'incomplete' | 'complete'): Promise<void> {
        try {
            // First, find the row with the order ID
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A:J',
            });

            const rows = response.data.values;
            if (!rows) return;

            // Find the row index (0-based)
            let rowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][0] === orderId) {
                    rowIndex = i + 1; // Convert to 1-based index
                    break;
                }
            }

            if (rowIndex === -1) {
                throw new Error('Order ID not found');
            }

            // Update the status column (column I, 9th column)
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Sheet1!I${rowIndex}`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[status]]
                }
            });

            console.log(`Payment status updated to ${status} for order ${orderId}`);
        } catch (error) {
            console.error('Error updating payment status:', error);
            throw error;
        }
    }

    // Get payment data by order ID
    static async getPaymentByOrderId(orderId: string): Promise<PaymentData | null> {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A:J',
            });

            const rows = response.data.values;
            if (!rows) return null;

            for (const row of rows) {
                if (row[0] === orderId) {
                    return {
                        orderId: row[0],
                        robloxUsername: row[1],
                        discordUsername: row[2],
                        discordUserId: row[3],
                        robuxAmount: parseInt(row[4]),
                        paymentAmount: parseInt(row[5]),
                        screenshotUrl: row[6],
                        timestamp: row[7],
                        status: row[8] as 'incomplete' | 'complete',
                        ticketChannelId: row[9]
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('Error getting payment data:', error);
            throw error;
        }
    }

    // Initialize the sheet with headers
    static async initializeSheet(): Promise<void> {
        try {
            const headers = [
                'Order ID',
                'Roblox Username',
                'Discord Username',
                'Discord User ID',
                'Robux Amount',
                'Payment Amount (NPR)',
                'Screenshot URL',
                'Timestamp',
                'Status',
                'Ticket Channel ID'
            ];

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A1:J1',
                valueInputOption: 'RAW',
                requestBody: {
                    values: [headers]
                }
            });

            console.log('Sheet initialized with headers');
        } catch (error) {
            console.error('Error initializing sheet:', error);
            throw error;
        }
    }
}
