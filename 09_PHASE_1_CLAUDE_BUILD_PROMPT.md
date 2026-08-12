# FIRST IMPLEMENTATION PROMPT FOR CLAUDE

We are starting implementation of the **Global Household App**.

You have been provided the approved project context files. Treat them as source of truth.

## IMPORTANT
Do NOT build the entire application yet.

We are beginning only:

# PHASE 1 — TECHNICAL FOUNDATION

## Approved Stack
- TypeScript
- React Native
- Expo
- Expo Router
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime/Broadcast
- Supabase Edge Functions
- Git/GitHub
- iOS + Android + Web/PWA from one primary codebase
- Modular monolith

## Non-Negotiable Global Rules
1. Never hard-code USD.
2. Never hard-code `$`.
3. Prepare for all supported ISO currencies.
4. Never persist money using floating point.
5. Prepare for locale-aware dates/numbers/currency.
6. Prepare for English, Filipino/Tagalog, Arabic.
7. Prepare for RTL.
8. Every household-owned record will eventually be protected by `household_id` + RLS.
9. Never expose server secrets to client code.
10. Do not implement microservices.
11. Do not prematurely implement retailer integrations.
12. Do not implement subscriptions yet.
13. Do not implement bank sync.
14. Do not implement receipt OCR.
15. Do not implement AI financial advice.
16. Do not invent requirements outside approved specs.

## Phase 1 Deliverables

### A. Repository/folder structure
Recommend the exact initial structure.

### B. Initialization commands
Provide exact commands to initialize the Expo/TypeScript/Expo Router project and dependencies.

### C. Expo Router
Configure universal navigation foundation.

### D. TypeScript
Strict, maintainable TypeScript configuration.

### E. Supabase Client
Create safe client configuration using only publishable client credentials.

### F. Environment Strategy
Define development/staging/production environment approach and `.env` practices.

### G. Localization
Set up:
- expo-localization
- i18next
- react-i18next

Include initial locale resources for:
- en
- fil
- ar

Use placeholder keys only; do not build a full translation catalog yet.

### H. RTL Readiness
Create the architectural foundation needed for Arabic RTL without redesign later.

### I. Design System Skeleton
Create reusable UI organization without prematurely designing the final brand.

### J. Error Handling
Create a central error model / safe error presentation approach.

### K. Logging
Create a minimal logging abstraction that can later integrate crash/observability providers.

Do not log secrets, passwords, OTPs, tokens, or sensitive financial data.

### L. Validation
Set up Zod and a clear validation organization pattern.

### M. Navigation Skeleton
Create placeholder screens only:
- Login
- Signup
- Home
- Budget
- Transactions
- Grocery
- More

No real business functionality yet.

### N. Supabase Structure
Create:
- `supabase/migrations/`
- `supabase/functions/`
- seed/local setup structure where appropriate

Do NOT create the full production schema yet unless necessary for foundation.

### O. Testing Foundation
Set up a reasonable unit/component testing foundation for Expo/React Native.

### P. Git/GitHub
Provide:
- `.gitignore`
- branch recommendation
- commit hygiene
- PR recommendation

### Q. README
Create a developer README explaining:
- prerequisites
- installation
- environment setup
- how to run iOS/Android/web
- how to run tests
- project structure

## Before Writing Code
First output:
1. Proposed folder structure.
2. Architecture decisions for Phase 1.
3. Dependency list.
4. Files you intend to create/change.
5. Any concerns/contradictions found in the source-of-truth documents.

Then implement incrementally.

## For Every File
- State exact file path.
- Give complete file content.
- Explain purpose.
- Mention dependencies.
- Avoid unrelated modifications.

## Definition of Done for Phase 1
Phase 1 is done only when:
- app starts on iOS
- app starts on Android
- app starts on web
- routing works
- placeholder tabs/screens work
- Supabase development client initializes safely
- localization framework works
- RTL foundation exists
- testing command works
- repo contains no secrets
- README lets another developer clone and run the project

At the end, provide a Phase 1 verification checklist.

Do NOT automatically continue to Phase 2.
Stop after Phase 1 and wait for developer review.
