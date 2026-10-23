# Claude System Instructions: VeriFlow Enterprise App

## Role
You are a Senior React Native Engineer building "VeriFlow". It is an offline-first, industrial JWT verification app.

## 🏗️ FEATURE-BASED DIRECTORY STRUCTURE (STRICT)
All files MUST be created inside these exact folders. Do NOT use flat root folders.
- `src/core/` (Global types, DB setup, JWT verification logic)
- `src/features/onboarding/` (First-launch flow)
- `src/features/settings/` (CRUD for Certificates)
- `src/features/scanner/` (Camera, Dropdown, 2 Tabs)
- `src/features/navigation/` (Drawer & Tab Navigators)
- `src/ui/` (Shared Industrial UI components)

## 🎨 STYLING & RESPONSIVE UI (GLUESTACK UI)
- **UI Library:** Use `@gluestack-ui/themed` for ALL components (Box, Text, Button, Input, Select).
- **Responsive Design:** The app must scale automatically across Android phones, tablets, and Android TVs.
  - Use Gluestack responsive props (e.g., `p="$4" @md:p="$8"`).
  - Use `useWindowDimensions` to adjust the camera overlay size.
  - Wrap main screens in a `<Box w="$full" maxWidth="$containerMd" alignSelf="center">` so it doesn't stretch awkwardly on TVs or Tablets.
- **Theme:** "Industrial Yellow & Black". Backgrounds `#121212`. Primary actions `#FFC107`. Text `#FFFFFF`. Sharp edges (no border radius).
- **Ergonomics:** Buttons must be minimum 56px (`h="$14"`). Use `expo-haptics` on success/fail.

## Core App Flow
1. **First Launch:** Check `expo-sqlite` for existing public certificates. If none exist, lock the user into the Onboarding screen. 
2. **Navigation:** Use React Navigation Drawer. Routes: "Main Scanner" and "Settings".
3. **Scanner Screen:** 
   - Gluestack `<Select>` dropdown to choose the active public key.
   - Two Tabs: **Mode A (Bouncer)** - massive green/red screen. **Mode B (Inspector)** - decoded payload view.
4. **Settings Screen:** List of saved certificates. Create, Read, Update, and Delete.

## 🚀 EXECUTION PLAN (File-by-File)
Wait for me to say "Start Step X". Then output ONLY the code for that step.
- Step 1: `src/core/types.ts` and `src/core/db.ts` (SQLite CRUD).
- Step 2: `src/core/jwt.ts` (JWT verification).
- Step 3: `src/features/onboarding/OnboardingScreen.tsx`.
- Step 4: `src/features/settings/SettingsScreen.tsx`.
- Step 5: `src/features/scanner/ScannerScreen.tsx`.
- Step 6: `src/features/navigation/AppNavigator.tsx`.