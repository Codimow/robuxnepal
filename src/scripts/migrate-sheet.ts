import { google } from "googleapis";
import { JWT } from "google-auth-library";
import dotenv from "dotenv";

dotenv.config();

// Initialize Google Sheets API
const auth = new JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : undefined,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";

interface CleanPaymentData {
    orderId: string;
    discordUsername: string;
    robloxUsername: string;
    robuxAmount: number;
    paymentAmount: number;
    status: string;
    createdAt: string;
    completionTimestamp: string;
    discordUserId: string;
    ticketChannelId: string;
    screenshotUrl: string;
}

async function migrateSheet() {
    console.log("🔄 Starting sheet migration...");

    try {
        // Step 1: Read all existing data
        console.log("📖 Reading existing data...");
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Sheet1!A1:Z100", // Read everything
        });

        const rows = response.data.values || [];
        console.log(`Found ${rows.length} rows`);

        // Step 2: Parse and clean the data
        console.log("🧹 Cleaning data...");
        const cleanedData: CleanPaymentData[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // Skip empty rows or header-like rows
            if (!row || row.length === 0) continue;
            if (row[0] === "Order ID") continue; // Skip header

            // Try to extract meaningful data from the messy row
            // Look for Order ID pattern (RN-xxx or RBX-xxx)
            let orderId = "";
            let discordUsername = "";
            let robloxUsername = "";
            let robuxAmount = 0;
            let status = "incomplete";
            let createdAt = "";
            let completionTimestamp = "";
            let discordUserId = "";
            let ticketChannelId = "";
            let screenshotUrl = "";

            // Find order ID
            for (const cell of row) {
                if (cell && typeof cell === "string" && (cell.startsWith("RN-") || cell.startsWith("RBX-"))) {
                    orderId = cell;
                    break;
                }
            }

            if (!orderId) continue; // Skip if no order ID found

            // Find status
            for (const cell of row) {
                if (cell === "pending" || cell === "incomplete" || cell === "complete") {
                    status = cell;
                    break;
                }
            }

            // Find usernames and other data
            for (let j = 0; j < row.length; j++) {
                const cell = row[j];
                if (!cell) continue;

                // Look for Discord username (not a number, not order ID)
                if (typeof cell === "string" && !cell.startsWith("RN-") && !cell.startsWith("RBX-") &&
                    !cell.includes("http") && !cell.includes("2025") && isNaN(Number(cell)) &&
                    cell !== status && !discordUsername) {
                    discordUsername = cell;
                }

                // Look for Roblox username
                if (typeof cell === "string" && !cell.startsWith("RN-") && !cell.startsWith("RBX-") &&
                    !cell.includes("http") && !cell.includes("2025") && isNaN(Number(cell)) &&
                    cell !== status && cell !== discordUsername && !robloxUsername) {
                    robloxUsername = cell;
                }

                // Look for amounts (numbers)
                if (!isNaN(Number(cell)) && Number(cell) > 0 && robuxAmount === 0) {
                    robuxAmount = Number(cell);
                }

                // Look for timestamps
                if (typeof cell === "string" && cell.includes("2025") && !createdAt) {
                    createdAt = cell;
                }

                // Look for Discord user ID (long number)
                if (typeof cell === "string" && !isNaN(Number(cell)) && cell.length > 15 && !discordUserId) {
                    discordUserId = cell;
                }

                // Look for screenshot URL
                if (typeof cell === "string" && cell.includes("http") && !screenshotUrl) {
                    screenshotUrl = cell;
                }
            }

            // Add to cleaned data if we have minimum requirements
            if (orderId && (discordUsername || robloxUsername)) {
                cleanedData.push({
                    orderId,
                    discordUsername: discordUsername || "Unknown",
                    robloxUsername: robloxUsername || "Unknown",
                    robuxAmount: robuxAmount || 0,
                    paymentAmount: robuxAmount || 0,
                    status,
                    createdAt: createdAt || new Date().toISOString(),
                    completionTimestamp: status === "complete" ? (completionTimestamp || new Date().toISOString()) : "",
                    discordUserId: discordUserId || "",
                    ticketChannelId: ticketChannelId || "",
                    screenshotUrl: screenshotUrl || "",
                });
            }
        }

        console.log(`✅ Cleaned ${cleanedData.length} records`);

        // Step 3: Clear the sheet
        console.log("🗑️  Clearing sheet...");
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: "Sheet1!A1:Z100",
        });

        // Step 4: Write headers
        console.log("📝 Writing headers...");
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

        // Step 5: Write cleaned data
        if (cleanedData.length > 0) {
            console.log("💾 Writing cleaned data...");
            const values = cleanedData.map((data) => [
                data.orderId,
                data.discordUsername,
                data.robloxUsername,
                data.robuxAmount,
                data.paymentAmount,
                data.status,
                data.createdAt,
                data.completionTimestamp,
                data.discordUserId,
                data.ticketChannelId,
                data.screenshotUrl,
            ]);

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: "Sheet1!A2:K",
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: values,
                },
            });
        }

        console.log("✅ Migration complete!");
        console.log(`📊 Migrated ${cleanedData.length} records to the new clean format`);
        console.log("\n🎉 Your spreadsheet is now organized!");

    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    }
}

// Run migration
migrateSheet()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
