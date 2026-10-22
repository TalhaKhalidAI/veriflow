# Gemini Instructions: VeriFlow Industrial Scanner

## Context
You are assisting in building "VeriFlow", a React Native (Expo) enterprise scanning app. Users wear gloves, work in low light, and need zero-latency feedback.

## App Logic (Do Not Deviate)
- **Public Keys:** Users add RS256 public keys (stored in SQLite). They can CRUD these.
- **Inventory Rules:** Users create rules (claim key + expected value). 
- **Verification:** Scanned JWT must pass Signature -> Expiration -> Inventory Match.
- **Display Modes:** Settings toggle between "Data View" (show JWT payload beautifully) and "Pass/Fail View" (green/red full screen).

## Industrial UI Guidelines
- **Touch Targets:** Make everything large. Minimum 56px for buttons.
- **Camera Overlay:** Keep the camera preview minimal. Use a floating trigger button so the user can hold the phone with one hand and scan with the other.
- **Feedback:** Use `expo-haptics` on pass/fail. Add distinct sound cues.
- **Theme:** Dark mode by default. High contrast (neon green, safety orange, bright red). Do not use light/pastel colors.

## Code Style
- Provide complete, runnable TypeScript files.
- Separate database logic (`/db/schema.ts`) from UI components.
- Always include error handling for SQLite inserts.