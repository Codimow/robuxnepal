import { google } from "googleapis";
import { JWT } from "google-auth-library";
import { config } from "./config";
import { logger } from "./logger";
import { GoogleSheetsError, retryWithBackoff } from "./errorHandler";

// Initialize Google Sheets API
const auth = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
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
          paymentData.discordUsername,
          paymentData.robloxUsername,
          paymentData.robuxAmount,
          paymentData.paymentAmount,
          paymentData.status,
          paymentData.createdAt,
          paymentData.completionTimestamp || "",
          paymentData.discordUserId,
          paymentData.ticketChannelId || "",
          paymentData.screenshotUrl || "",
        ],
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A:K",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: values,
        },
      });

      logger.success(
        `Payment data added to sheet - Order ID: ${paymentData.orderId}`,
      );
    } catch (error) {
      logger.error("Error adding payment to sheet", error);
      throw new GoogleSheetsError(
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

      // Update the status column (column F, 6th column)
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Sheet1!F${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[status]],
        },
      });

      // Update completion timestamp (column H, 8th column) if status is complete
      if (status === "complete") {
        const completionTimestamp = new Date().toISOString();
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Sheet1!H${rowIndex}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [[completionTimestamp]],
          },
        });
      }

      logger.success(`Payment status updated to ${status} for order ${orderId}`);
    } catch (error) {
      logger.error("Error updating payment status", error);
      throw new GoogleSheetsError("Failed to update payment status");
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
          // Detect if this is old format or new format
          // New format has status at index 5, old format has it at index 8
          const isNewFormat = row[5] === "pending" || row[5] === "incomplete" || row[5] === "complete";

          if (isNewFormat) {
            // New format: OrderId, DiscordUsername, RobloxUsername, RobuxAmount, PaymentAmount, Status, CreatedAt, CompletionTimestamp, DiscordUserId, TicketChannelId, ScreenshotURL
            return {
              orderId: row[0],
              discordUsername: row[1],
              robloxUsername: row[2],
              robuxAmount: parseInt(row[3]) || 0,
              paymentAmount: parseInt(row[4]) || 0,
              status: row[5] as "pending" | "incomplete" | "complete",
              createdAt: row[6] || new Date().toISOString(),
              completionTimestamp: row[7] || undefined,
              discordUserId: row[8],
              ticketChannelId: row[9] || "",
              screenshotUrl: row[10] || "",
            };
          } else {
            // Old format: OrderId, RobloxUsername, DiscordUsername, DiscordUserId, RobuxAmount, PaymentAmount, ScreenshotURL, CreatedAt, Status, TicketChannelId, CompletionTimestamp
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
      }

      return null;
    } catch (error) {
      logger.error("Error getting payment data", error);
      throw new GoogleSheetsError("Failed to retrieve payment data");
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

        // Detect format
        const isNewFormat = row[5] === "pending" || row[5] === "incomplete" || row[5] === "complete";
        const statusIndex = isNewFormat ? 5 : 8;
        const completionIndex = isNewFormat ? 7 : 10;

        if (row[statusIndex] === "complete" && row[completionIndex]) {
          // Status is complete and has completion timestamp
          const completionTime = new Date(row[completionIndex]).getTime();
          if (now - completionTime >= twentyFourHours) {
            if (isNewFormat) {
              paymentsToDelete.push({
                orderId: row[0],
                discordUsername: row[1],
                robloxUsername: row[2],
                robuxAmount: parseInt(row[3]) || 0,
                paymentAmount: parseInt(row[4]) || 0,
                status: row[5] as "complete",
                createdAt: row[6] || new Date().toISOString(),
                completionTimestamp: row[7],
                discordUserId: row[8],
                ticketChannelId: row[9] || "",
                screenshotUrl: row[10] || "",
              });
            } else {
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
      }

      return paymentsToDelete;
    } catch (error) {
      logger.error("Error getting completed payments for deletion", error);
      throw new GoogleSheetsError("Failed to retrieve completed payments");
    }
  }

  // Initialize the sheet with headers
  static async initializeSheet(): Promise<void> {
    try {
      const headers = [
        "Order ID",
        "Discord Username",
        "Roblox Username",
        "Robux Amount",
        "Payment Amount (NPR)",
        "Status",
        "Created At",
        "Completion Timestamp",
        "Discord User ID",
        "Ticket Channel ID",
        "Screenshot URL",
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Sheet1!A1:K1",
        valueInputOption: "RAW",
        requestBody: {
          values: [headers],
        },
      });

      logger.success("Sheet initialized with headers");
    } catch (error) {
      logger.error("Error initializing sheet", error);
      throw new GoogleSheetsError("Failed to initialize sheet");
    }
  }
}
