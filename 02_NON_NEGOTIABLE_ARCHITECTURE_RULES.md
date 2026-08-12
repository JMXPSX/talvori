# Non-Negotiable Architecture Rules

## Approved Architecture
Use a **modular monolith** for MVP.

Do NOT begin with microservices.

Primary structure:

`Expo universal app -> Supabase/Auth/Postgres/Realtime/Edge Functions -> authorized external providers`

Possible future extraction only when scale requires it:
- Price intelligence service
- Product catalog service
- Notification service
- Analytics service

## Core Stack
- TypeScript
- React Native
- Expo
- Expo Router
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime / Broadcast
- Supabase Edge Functions
- Supabase Storage as needed
- Git / GitHub

## Client Rules
The mobile/web client must never contain privileged service secrets.

Do not place these in `EXPO_PUBLIC_*`:
- Supabase service role / secret keys
- Stripe secret key
- Retailer partner secret
- SMS provider secret
- FX provider secret
- RevenueCat secret webhook credentials

## Backend Rules
Sensitive third-party calls belong server-side, normally in Supabase Edge Functions during MVP.

Examples:
- Retailer data normalization
- Coupon/provider integration
- FX synchronization
- Subscription webhooks
- Secure token exchange

## Multi-Tenant Rule
Every household-owned record must be scoped to a `household_id` or an equivalent explicit ownership model.

Household isolation must be enforced by PostgreSQL Row Level Security.

Never trust a client-provided `household_id` by itself.

## Environments
At minimum:
- Development
- Production

Preferred before public launch:
- Development
- Staging
- Production

Database changes must use versioned migrations.

## Repository Philosophy
Prefer feature-based organization.

Suggested top-level structure:

```text
app/
components/
features/
lib/
services/
locales/
supabase/
tests/
```

Do not build a giant unstructured screens folder.

## AI Coding Rule
Claude must generate small, reviewable changes.

For every implementation task:
- State file path.
- Give complete file content for created/modified files.
- Explain what changes.
- List dependencies.
- Do not modify unrelated files.
- Include tests for high-risk logic.
