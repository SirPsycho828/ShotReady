# ShotReady

Mobile-first OS for independent real estate listing photographers. Manages booking-to-delivery workflow.

## Project Structure

pnpm monorepo:
- `apps/mobile` - React Native + Expo (NativeWind, Gluestack UI, Expo Router)
- `apps/web` - Vite + React (agent pages + web companion)
- `functions` - Firebase Cloud Functions 2nd gen (TypeScript)
- `packages/shared` - Shared TypeScript types and constants

## Commands

- `pnpm mobile` - Start Expo dev server
- `pnpm web` - Start Vite dev server
- `pnpm functions:build` - Build Cloud Functions
- `pnpm typecheck` - Typecheck all packages

## Firebase

Project: `shotready-001`
Region: `us-central1`

## Key Decisions

- Single-photographer v1 (no multi-tenancy)
- Agents never create accounts (token-based URL access)
- Firestore offline persistence for field use
- Dark mode default, light mode for shoots
- Monetary values in cents (integer)
- Timestamps use Firestore Timestamp type
