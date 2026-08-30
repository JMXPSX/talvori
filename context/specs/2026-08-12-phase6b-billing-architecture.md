# Phase 6 Slice 6b — Billing Integrations — ADR (deferred)

Date: 2026-08-12
Status: Deferred — blocked on external accounts. Documented so it executes onto
6a's model unchanged when accounts exist.

## Why deferred

Live billing needs external prerequisites that don't exist yet:
- **Apple:** App Store Connect account, subscription products, StoreKit.
- **Google:** Play Console account, subscription products, Play Billing.
- **Web:** a payment processor account (e.g. Stripe) with API keys.
- **Backend:** a server (Supabase Edge Function) to receive webhooks and hold
  secrets — retailer/processor secrets must never ship in the client.

Building these against nonexistent credentials would be speculative scaffolding.
6a already ships the model and gates everything writes into.

## The contract 6b writes into (from 6a)

`household_subscriptions` — one row per household, with `plan_code`, `status`,
`source` (`manual|apple|google|stripe`), `current_period_end`. 6a's manual grant
writes `source='manual'`. Every 6b path writes the SAME row with its own `source`;
`resolvePlan(sub, now)` already turns that row into the effective plan. No schema
change is required for 6b — only new writers.

## Architecture

```
Mobile (Apple/Google IAP)  ─┐
Web (Stripe Checkout)       ─┼─> purchase → store/processor
                             │
store/processor webhook  ──> Supabase Edge Function (secrets server-side)
                             └─> verify → upsert household_subscriptions (service role)
                                   plan_code/status/source/current_period_end
Client reads household_subscriptions via RLS → EntitlementsProvider → gates
```

- **Apple IAP:** `expo-in-app-purchases` or RevenueCat; verify receipts
  server-side; map product → `plan_code`; write row `source='apple'`.
- **Google Play billing:** Play Billing via the same IAP layer / RevenueCat;
  verify purchase tokens server-side; write `source='google'`.
- **Web:** Stripe Checkout + Customer Portal; Stripe webhooks
  (`checkout.session.completed`, `customer.subscription.updated/deleted`) →
  Edge Function → write `source='stripe'`, set `current_period_end`.
- **Restore purchase:** re-query the store for active entitlements; re-upsert the
  row. (Web: the portal is the source of truth.)
- **Regional pricing:** prices come from the store/processor per storefront —
  never a single USD model. The client displays store-provided localized prices;
  our DB stores only the resulting `plan_code`, not prices.
- **Cancellation/expiry:** webhooks set `status='canceled'` / `current_period_end`;
  `resolvePlan` downgrades to free automatically at expiry.

## Payer → household mapping

A purchase is tied to one Apple/Google/Stripe account (the payer). On success the
Edge Function upserts the payer's **active household** subscription (or a household
id passed through the purchase metadata). Per-household entitlement (6a decision)
means one payer upgrades the whole household.

## Security / rules

- Secrets (receipt-validation keys, Stripe secret key, webhook signing secrets)
  live in Edge Function secrets — never in `EXPO_PUBLIC_*` or client code.
- Webhook handlers verify signatures before writing.
- The 6a **manual toggle must be removed or hard-guarded** (e.g. dev-only build
  flag) before production launch — it's a free-premium hole otherwise.

## Reuses (already built in 6a)

- `household_subscriptions` table + RLS.
- `features/billing/plans.ts` (`resolvePlan`, `PLAN_CAPABILITIES`).
- `EntitlementsProvider` / `usePlan()` — no change; it just reads the row.
- `app/subscription.tsx` — becomes the real "Manage subscription" entry point
  (buttons route to store purchase / Stripe Checkout instead of the manual toggle).

## When to execute

When there is at least one funded store/processor account + a deployed Edge
Function. Start with one path (likely Stripe web or one store), verify the
webhook→row→gate loop end-to-end, then add the others.
