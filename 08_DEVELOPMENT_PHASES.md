# Development Phases

## Phase 0 — Product / Architecture Freeze
Before major code, prepare/review:
- PRD
- TRD
- architecture diagram
- ERD
- screen map
- household permission matrix
- RLS plan
- MVP backlog
- ADR starter

## Phase 1 — Technical Foundation
Build:
- Expo universal app
- TypeScript
- Expo Router
- Supabase client foundation
- environment strategy
- localization
- RTL readiness
- validation
- error handling
- logging
- design-system skeleton
- testing foundation
- Git/GitHub setup
- placeholder navigation/screens

Exit criteria:
- project runs on iOS, Android, web
- development backend connection works
- no business data functionality yet

## Phase 2 — Authentication & Household Security
Build:
- registration/login
- email verification
- email OTP
- SMS OTP
- Google
- Apple
- MFA/TOTP
- passkey-ready flow
- biometrics
- recovery
- sessions/devices
- households
- invitations
- roles
- RLS

Exit criteria:
- household isolation tests pass
- unauthorized users cannot read/write other household data

## Phase 3 — Financial Core
Build:
- accounts
- transactions
- income/expense/transfer
- categories
- budgets
- savings goals
- debts
- multi-currency money engine
- FX snapshot foundation
- dashboard

## Phase 4 — Shared Household Shopping
Build:
- grocery lists
- realtime sync
- added/purchased by
- estimated/actual cost
- notifications where appropriate
- expense conversion

Exit criteria:
- real household can use app daily across multiple devices

## Phase 5 — Retail Intelligence Beta
Build:
- products
- variants
- retailers
- store branches
- price snapshots
- connector interface
- unit price normalization
- branch/location selection
- coupon/promotion schema
- initial authorized data sources

## Phase 6 — Commercialization
Build:
- free/premium plans
- entitlements
- Apple subscriptions
- Google Play subscriptions
- web billing
- regional pricing
- restore purchase
- subscription webhooks

## Phase 7 — Globalization
Validate priority countries for:
- currencies
- languages
- dates/numbers
- timezones
- RTL
- subscriptions
- privacy flows
- retailer availability

## Phase 8 — Security / QA / Hardening
- RLS audit
- secret audit
- auth tests
- payment tests
- money/FX tests
- session tests
- account deletion/export tests
- network failure tests
- backup/recovery review
- performance
- crash monitoring

## Phase 9 — Beta
Start with:
- founder
- spouse
- software consultant/developer brother
- trusted users

Then:
- TestFlight
- Google testing track
- web beta

## Phase 10 — Production Launch
- Apple App Store
- Google Play
- Web/PWA
- staged country rollout
- retailer price coverage may be separately marked beta/supported
