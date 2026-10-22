# Copilot Instructions for VeriFlow (Industrial JWT Scanner)

## Project Context
VeriFlow is an offline-first React Native (Expo SDK 58) app for warehouse, airport, and event scanning. It verifies RS256 JWTs against local public keys and dynamic inventory IDs.

## Core Database & CRUD Rules
- Use `expo-sqlite` for all local storage.
- **Public Keys Table:** Allow full CRUD (Create, Read, Update, Delete). Store `id`, `name`, `public_key_string`, `created_at`.
- **Inventory IDs Table:** Allow full CRUD. Store `id`, `inventory_name`, `matching_claim_key` (e.g., "warehouse_id"), `expected_value` (e.g., "WH-01").
- **Scans Queue Table:** Store `id`, `scanned_jwt`, `status`, `sync_status: 'pending'`.

## JWT Verification Logic
- When a QR is scanned, parse the JWT and verify the signature using the selected public key from SQLite.
- **Expiration Check:** Reject if `exp` is missing or expired.
- **Inventory Check:** Compare the JWT payload's claim (defined by `matching_claim_key`) against the `expected_value` in the Inventory IDs table.
- **UI Modes:** 
  1. `DATA_MODE`: Show a beautiful, parsed view of the JWT payload.
  2. `PASS_FAIL_MODE`: Show a massive Green (Pass) or Red (Fail) screen.

## Industrial UI/UX Rules
- **Touch Targets:** Minimum 56px height for all buttons.
- **Contrast:** High-contrast dark theme (e.g., dark slate background, neon green for success, bright red for failure). Avoid light pastels.
- **Feedback:** Trigger `expo-haptics` (`Haptics.notificationAsync`) on every successful/failed scan. Play a loud distinct sound on pass/fail.
- **Scanning Overlay:** Use a minimalistic camera preview with a floating, draggable trigger button (Scandit style) so workers can hold the device ergonomically.