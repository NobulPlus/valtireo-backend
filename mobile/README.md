# Valtireo mobile

Employee self-service app using Expo SDK 57. The brand assets match the web client's `Logomark` and website favicon.

## Local checks

Run `npm ci`, `npm run lint`, `npm run typecheck`, and `npm test` in this directory. Run `npm start` to open Expo.
Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the API address reachable by your device. An Android emulator can use `10.0.2.2`; a physical phone needs a reachable LAN or HTTPS address.

## Installable builds

The EAS `preview` profile produces an internally distributed Android APK; `production` builds for the app stores. Set `EXPO_PUBLIC_API_BASE_URL` in the matching EAS environment before building. Connect this project to your Expo account with `npx eas-cli@latest init`, then run `npx eas-cli@latest build --platform android --profile preview`. Signing credentials and store accounts must belong to the product owner.

An exported JavaScript bundle is not an installed-device test. Before release, verify on Android and iOS: sign-in/relaunch/logout; storage failure recovery; expired sessions; switching accounts; offline retry; multi-page history; document upload/download/acknowledgement/signed copy; photo upload; leave submission; payslip sharing. Confirm the launcher icon after installing a new binary (reloading Expo Go does not change its launcher icon).
