import { google } from "googleapis";
import { config } from "./config";

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// Get Google Sheet ID from config
const SPREADSHEET_ID = config.GOOGLE_SHEET_ID || "your_sheet_id_here";

export interface PaymentData {
  orderId: string;
  robloxUsername: string;
  discordUsername: string;
  discordUserId: string;
  robuxAmount: number;
  paymentAmount: number;
  screenshotUrl?: string;
  timestamp?: string;
  status: "pending" | "incomplete" | "complete";
  ticketChannelId?: string;
  createdAt: string;
  completionTimestamp?: string;
}

export class PaymentSheetService {
  // Add payment data to the sheet
  static async addPayment(paymentData: PaymentData): Promise<void> {
    try {
      // Validate required fields
      if (
        !paymentData.orderId ||
        !paymentData.robloxUsername ||
        !paymentData.discordUsername
      ) {
        throw new Error("Missing required payment data fields");
      }

      const values = [
        [
          paymentData.orderId,
          paymentData.robloxUsername,
          paymentData.discordUsername,
          paymentData.discordUserId,
          paymentData.robuxAmount,
          paymentData.paymentAmount,
          paymentData.screenshotUrl || "",
          paymentData.createdAt,
          paymentData.status,
          paymentData.ticketChannelId || "",
          paymentData.completionTimestamp || "",
        ],
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:K",
        valueInputOption: "RAW",
        requestBody: {
          values: values,
        },
      });

      console.log(
        `Payment data added to sheet successfully - Order ID: ${paymentData.orderId}`,
      );
    } catch (error) {
      console.error("Error adding payment to sheet:", error);
      throw new Error(
        `Failed to add payment to sheet: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Update payment status
  static async updatePaymentStatus(
    orderId: string,
    status: "incomplete" | "complete",
  ): Promise<void> {
    try {
      // First, find the row with the order ID
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:K",
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
        throw new Error("Order ID not found");
      }

      // Update the status column (column I, 9th column)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!I${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[status]],
        },
      });

      // Update completion timestamp (column K, 11th column) if status is complete
      if (status === "complete") {
        const completionTimestamp = new Date().toISOString();
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Sheet1!K${rowIndex}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [[completionTimestamp]],
          },
        });
      }

      console.log(`Payment status updated to ${status} for order ${orderId}`);
    } catch (error) {
      console.error("Error updating payment status:", error);
      throw error;
    }
  }

  // Get payment data by order ID
  static async getPaymentByOrderId(
    orderId: string,
  ): Promise<PaymentData | null> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:K",
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
            robuxAmount: parseInt(row[4]) || 0,
            paymentAmount: parseInt(row[5]) || 0,
            screenshotUrl: row[6] || "",
            createdAt: row[7] || new Date().toISOString(),
            status: row[8] as "pending" | "incomplete" | "complete",
            ticketChannelId: row[9] || "",
            completionTimestamp: row[10] || undefined,
          };
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting payment data:", error);
      throw error;
    }
  }

  // Get all completed payments that need deletion (completed 24+ hours ago)
  static async getCompletedPaymentsForDeletion(): Promise<PaymentData[]> {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:K",
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) return []; // Skip header row

      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const paymentsToDelete: PaymentData[] = [];

      for (let i = 1; i < rows.length; i++) {
        // Start from 1 to skip header
        const row = rows[i];
        if (row[8] === "complete" && row[10]) {
          // Status is complete and has completion timestamp
          const completionTime = new Date(row[10]).getTime();
          if (now - completionTime >= twentyFourHours) {
            paymentsToDelete.push({
              orderId: row[0],
              robloxUsername: row[1],
              discordUsername: row[2],
              discordUserId: row[3],
              robuxAmount: parseInt(row[4]) || 0,
              paymentAmount: parseInt(row[5]) || 0,
              screenshotUrl: row[6] || "",
              createdAt: row[7] || new Date().toISOString(),
              status: row[8] as "complete",
              ticketChannelId: row[9] || "",
              completionTimestamp: row[10],
            });
          }
        }
      }

      return paymentsToDelete;
    } catch (error) {
      console.error("Error getting completed payments for deletion:", error);
      throw error;
    }
  }

  // Initialize the sheet with headers
  static async initializeSheet(): Promise<void> {
    try {
      const headers = [
        "Order ID",
        "Roblox Username",
        "Discord Username",
        "Discord User ID",
        "Robux Amount",
        "Payment Amount (NPR)",
        "Screenshot URL",
        "Created At",
        "Status",
        "Ticket Channel ID",
        "Completion Timestamp",
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A1:K1",
        valueInputOption: "RAW",
        requestBody: {
          values: [headers],
        },
      });

      console.log("Sheet initialized with headers");
    } catch (error) {
      console.error("Error initializing sheet:", error);
      throw error;
    }
  }
}
