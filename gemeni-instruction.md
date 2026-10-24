# VeriFlow Gemini Instruction

You are building VeriFlow, an industrial offline JWT verification mobile app for Android using Expo and React Native.

## Product goal
- Verify JWTs locally with a stored public key.
- Scan QR strings containing a JWT.
- Allow selection of the verification public key from a SQLite-backed table.
- Show pass/fail feedback and decoded payload details.
- Keep the UI industrial, dark, high-contrast, and performance-focused.

## Core design rules
- Primary colors: black and yellow. Use deep navy-black backgrounds and bright industrial yellow highlights.
- Secondary action colors: muted slate panels, white labels, green pass states, and red fail states.
- Sharp edges, strong contrast, large readable typography, and bold UI hierarchy.
- Keep the layout mobile-first, but ensure it still looks polished on larger Android screens.
- Add tactile feedback for scan events and success/failure states.
- Use minimal chrome, strong data separation, and technical controls that feel like an industrialverification console.

## App structure
- Keep the app in the existing Expo project structure.
- Keep screen components in `src/Pages/` unless you are intentionally creating a route file under `src/app/`.
- Keep business logic in `src/core/`.
- Keep database logic, JWT verification, and UI state separated cleanly.

## Required screen behavior
- Scanner screen must include:
  - verification key dropdown
  - start/scan QR button
  - camera preview or placeholder state
  - pass/fail panel
  - decoded payload/data tab
  - scanned JWT display
- Settings should support:
  - adding public keys to SQLite
  - listing active keys
  - inventory rules with claim key and expected value

## JWT logic requirements
- Verify RS256 signatures with a PEM public key.
- Check `exp` claim.
- Strip only CR characters and outer whitespace from the public key, do not corrupt PEM content.
- Use the selected key from the dropdown for verification.
- Show clear error messaging when no key is selected, no JWT is found, or verification fails.

## UI quality bar
- Keep sections visually distinct with bordered cards and strong headings.
- Make the main action button large and clear.
- Use dark surfaces with yellow borders and strong text contrast.
- Keep status strings concise and technical.
- Better than before means cleaner hierarchy, stronger spacing, less clutter, more premium industrial appearance.

## Do not do
- Do not use overly rounded or soft mobile UI.
- Do not add useless animations or cartoon styling.
- Do not clutter the screen with decorative elements.
- Do not store malformed PEM data.
- Do not ignore the selected key during verification.

## Final output rule
- When implementing UI, prefer direct, working code with strong layout structure and a polished industrial look.
- Keep the app functional first, then refine the visual treatment to be sharper and more premium than the previous version.