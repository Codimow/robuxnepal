# Robux Nepal Verification System Documentation

## Overview

The Robux Nepal Discord bot now features an advanced verification system that allows moderators to easily verify payments through interactive buttons. This system provides a streamlined workflow for handling ticket verification with both quick and detailed verification options.

## Features

### 🔘 Interactive Button Verification
- **Detailed Verify**: Opens a modal for adding custom notes and selecting verification status
- **Quick Complete**: Instantly marks an order as complete with default notes
- **Quick Reject**: Instantly marks an order as incomplete with default notes

### 🛡️ Role-Based Access Control
- Only users with the configured moderator role can access verification buttons
- Automatic permission checking prevents unauthorized access
- Clear error messages for users without proper permissions

### 📊 Comprehensive Order Tracking
- Unique order ID generation (Format: `RN-TIMESTAMP-RANDOM`)
- Google Sheets integration for payment tracking
- Status updates with timestamp logging
- Verification history with moderator attribution

### ⏰ Automated Workflow
- Automatic ticket deletion 24 hours after completion
- User notifications upon order completion
- Scheduled cleanup of completed orders

## How It Works

### 1. Ticket Creation
When a user creates a ticket through the `/ticket` command or ticket button:
1. A modal collects Roblox username and Robux amount
2. A unique order ID is generated
3. A private ticket channel is created
4. Order details are saved to Google Sheets
5. Verification buttons are added to the ticket message

### 2. Verification Process

#### Detailed Verification
1. Moderator clicks "🔍 Detailed Verify" button
2. A modal opens for entering verification notes
3. Moderator selects "Complete Order" or "Mark Incomplete"
4. System processes the verification and updates records

#### Quick Verification
1. Moderator clicks either:
   - "✅ Quick Complete" - Instantly approves the order
   - "❌ Quick Reject" - Instantly rejects the order
2. System processes immediately with default notes

### 3. Order Completion
When an order is marked as complete:
1. Verification embed is posted with full details
2. Success message is sent mentioning the customer
3. Google Sheets status is updated to "complete"
4. Auto-deletion is scheduled for 24 hours later

## Verification Button Layout

Each ticket message contains three verification buttons:

```
[🔍 Detailed Verify] [✅ Quick Complete] [❌ Quick Reject]
```

### Button Functions

| Button | Function | Use Case |
|--------|----------|----------|
| 🔍 Detailed Verify | Opens modal for custom notes | Complex cases requiring explanation |
| ✅ Quick Complete | Instant approval | Standard successful payments |
| ❌ Quick Reject | Instant rejection | Clear invalid payments |

## Configuration Requirements

### Environment Variables
```env
MODERATOR_ROLE_ID=your_moderator_role_id
GOOGLE_SHEET_ID=your_google_sheet_id
TICKET_CATEGORY_ID=your_ticket_category_id (optional)
QR_CODE_URL=your_payment_qr_code_url (optional)
```

### Google Sheets Setup
The system requires a Google Sheet with the following columns:
1. Order ID
2. Roblox Username
3. Discord Username
4. Discord User ID
5. Robux Amount
6. Payment Amount (NPR)
7. Screenshot URL
8. Created At
9. Status
10. Ticket Channel ID
11. Completion Timestamp

## Verification Workflow Examples

### Successful Payment Verification
```
1. Customer creates ticket → Order ID: RN-ABC123-DEF456
2. Customer uploads payment screenshot
3. Moderator reviews payment
4. Moderator clicks "✅ Quick Complete"
5. System updates status to "complete"
6. Customer receives completion notification
7. Ticket auto-deletes after 24 hours
```

### Payment Issue Resolution
```
1. Customer creates ticket → Order ID: RN-XYZ789-UVW012
2. Customer uploads unclear screenshot
3. Moderator clicks "🔍 Detailed Verify"
4. Moderator adds note: "Screenshot unclear, please resubmit"
5. Moderator selects "❌ Mark Incomplete"
6. Customer receives feedback
7. Process repeats until resolved
```

## Technical Implementation

### File Structure
```
src/
├── events/
│   └── interactionCreate.ts    # Main interaction handler
├── utils/
│   ├── verification.ts         # Verification utilities
│   ├── sheets.ts              # Google Sheets integration
│   └── config.ts              # Configuration management
└── commands/
    └── verify.ts              # Legacy slash command (still available)
```

### Key Classes and Methods

#### `VerificationUtils`
- `hasModeratorPermission()` - Check user permissions
- `generateOrderId()` - Create unique order IDs
- `createVerificationButtons()` - Generate interactive buttons
- `processVerification()` - Handle verification logic
- `handleOrderCompletion()` - Process completed orders

#### `PaymentSheetService`
- `addPayment()` - Add new payment records
- `updatePaymentStatus()` - Update verification status
- `getPaymentByOrderId()` - Retrieve payment data

### Button Custom IDs
- `verify_payment_{orderId}` - Detailed verification modal
- `quick_verify_{orderId}_complete` - Quick approval
- `quick_verify_{orderId}_incomplete` - Quick rejection

## Error Handling

The system includes comprehensive error handling for:
- Invalid order IDs
- Missing payment data
- Permission violations
- Google Sheets connectivity issues
- Button interaction timeouts

## Security Features

### Permission Validation
- Role-based access control on all verification functions
- Double-checking of moderator permissions
- Ephemeral error messages to prevent spam

### Data Integrity
- Order ID validation with regex patterns
- Required field validation for payment data
- Automatic timestamp generation
- Status change logging

## Monitoring and Logging

The system logs important events:
- Payment creation and updates
- Verification actions with moderator attribution
- Error conditions and resolutions
- Auto-deletion schedules

## Migration from Old System

The new button-based verification system is fully compatible with:
- Existing `/verify` slash command
- Current Google Sheets structure
- Established ticket workflow
- Previous order data

## Best Practices for Moderators

### Quick Verification
Use quick buttons for:
- ✅ Clear, valid payment screenshots
- ❌ Obviously invalid or fake payments
- ✅ Repeat customers with good history

### Detailed Verification
Use detailed verification for:
- 📝 Partial payments requiring explanation
- 📝 Technical issues during processing
- 📝 Customer service situations requiring notes
- 📝 Training new moderators with documentation

## Troubleshooting

### Common Issues

**Buttons not appearing:**
- Check `MODERATOR_ROLE_ID` environment variable
- Verify bot has proper channel permissions
- Ensure ticket channel was created properly

**Permission denied errors:**
- Verify user has correct moderator role
- Check role ID matches configuration
- Confirm role hierarchy and permissions

**Verification failures:**
- Check Google Sheets connectivity
- Verify order ID exists in database
- Ensure proper error logging is enabled

## Future Enhancements

Planned improvements include:
- Verification analytics dashboard
- Automated payment validation
- Multi-language support
- Advanced reporting features
- Integration with payment processors