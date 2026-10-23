# Gemini Instructions: VeriFlow UI & Logic

## Context
You are building "VeriFlow", a React Native (Expo) app for scanning JWTs. The app must look rugged, industrial, and handle offline state perfectly.

## 🏗️ FEATURE-BASED DIRECTORY STRUCTURE
You must organize all generated code into these specific folders. Do not use generic root folders.
- `src/core/` (types, db, jwt)
- `src/features/onboarding/`
- `src/features/settings/`
- `src/features/scanner/`
- `src/features/navigation/`
- `src/ui/` (All shared Yellow/Black components like buttons)

## UI/UX Theme: Industrial Yellow & Black
- **Background:** Deep Charcoal/Black (`#121212`).
- **Primary Accent:** Safety Yellow (`#FFC107`) used for active tabs, primary buttons, and the camera scanning frame.
- **Typography:** Bold, sans-serif. High contrast White (`#FFFFFF`) text.
- **Components:** Thick borders (2px-3px). Sharp edges. Avoid soft shadows.

## App Navigation & Flow
1. **Onboarding:** If SQLite has no certs, show "Add Certificate" screen.
2. **Drawer Navigation:** "Main Scanner" and "Settings".
3. **Main Scanner (`src/features/scanner/ScannerScreen.tsx`):** 
   - Top: Dropdown to select active cert.
   - Middle: Camera view.
   - Bottom: Top Tabs (`Pass/Fail` mode and `Decoded Data` mode).
4. **Settings (`src/features/settings/SettingsScreen.tsx`):** List of certificates with Edit/Delete buttons.

## Verification Logic
- Use the active cert from the dropdown.
- Pass/Fail Tab: Green border + "Valid" or Red border + "Invalid".
- Decode Tab: Extract JWT and display payload clearly.