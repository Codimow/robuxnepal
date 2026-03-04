# Bug Report: Ticket Creation Permission Cache Failure

**Status:** ✅ Fixed
**Severity:** Critical (Prevented users from opening tickets)
**Date:** 2026-03-04
**Fixed By:** Gemini CLI

## 1. Description
When a user attempted to create a ticket via the "Create Ticket" button and modal, the bot failed to create the discord channel, resulting in the following error:
`TypeError [InvalidType]: Supplied parameter is not a cached User or Role`

## 2. Root Cause Analysis
The issue originated in the `discord.js` v14 library's `PermissionOverwrites.resolve` method. When creating a channel with `permissionOverwrites`, providing a string ID (like a Role ID or User ID) without an explicit `type` (Role vs Member) forces the library to check its internal cache to determine the entity type.

If the specific Role (e.g., the Moderator Role) or the User was not currently cached by the bot (common in larger servers or shortly after a bot restart), the library throws an `InvalidType` error because it cannot resolve the entity type from the cache.

## 3. Technical Impact
- **User Experience:** Users were unable to successfully submit the "Robux Purchase Ticket" modal.
- **Functional Failure:** No ticket channels were created, and the purchase flow was blocked.
- **Logging:** Error logs were generated during the `interactionCreate` event.

## 4. Resolution
The fix involved explicitly defining the `type` for every permission overwrite in the `createTicketChannel` utility function in `src/events/interactionCreate.ts`. This bypasses the need for `discord.js` to perform a cache lookup.

### Implementation Details:
1. Imported `OverwriteType` from `discord.js`.
2. Updated `permissionOverwrites` array to include:
   - `type: OverwriteType.Role` for `@everyone` and Moderator roles.
   - `type: OverwriteType.Member` for the ticket creator.

## 5. Verification
- [x] **Build Status:** `npm run build` completed successfully.
- [x] **Code Review:** All `permissionOverwrites` now include the `type` property using the `OverwriteType` enum.
- [x] **Intents Check:** Verified `GuildMembers` intent is active, but explicit typing ensures reliability regardless of cache state.
