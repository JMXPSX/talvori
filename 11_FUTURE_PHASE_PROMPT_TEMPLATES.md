# Future Phase Prompt Templates

Use these only after the prior phase is reviewed and approved.

---

## Phase 2 Prompt — Authentication & Household Security

Implement only Phase 2 from the approved project specification.

Scope:
- email/password
- email verification
- email OTP
- SMS OTP
- Google Sign-In
- Sign in with Apple
- MFA/TOTP
- passkey-compatible architecture
- Face ID/fingerprint session unlock
- recovery
- session/device management foundation
- profiles
- households
- household_members
- household_invitations
- roles
- RLS

Before code:
- propose schema
- provide ERD for this phase
- provide permission matrix
- provide RLS policy plan
- provide abuse/security cases

Exit condition:
Household A cannot access Household B through normal or manipulated client requests.

Do not proceed to finance automatically.

---

## Phase 3 Prompt — Financial Core

Implement only the approved financial core:
- accounts
- categories
- transactions
- income/expense/transfer
- budgets
- savings goals
- debts/debt payments
- multi-currency integer-minor-unit money engine
- FX snapshot foundation
- dashboard

Before code:
- propose schema/migrations
- specify money invariants
- specify transfer semantics
- specify FX history behavior
- specify test matrix

Never use floating point for persisted money.

---

## Phase 4 Prompt — Shared Grocery & Realtime

Implement:
- grocery_lists
- grocery_items
- realtime household sync
- added_by
- purchased_by
- quantity/unit
- estimated price
- actual price
- convert purchase to household expense
- basic notifications/activity where approved

Test multi-device concurrency and household isolation.

---

## Phase 5 Prompt — Retail Price & Coupon Beta

Implement only the retail intelligence foundation and explicitly approved retailer data sources.

Must include:
- retailers
- stores/branches
- saved shopping locations
- products/variants
- retailer_products
- price_snapshots
- promotions
- coupons
- connector interface
- unit normalization
- price freshness
- branch-specific queries

Do not add unauthorized scraping.
Do not add retailer credentials to client code.
Do not claim guaranteed real-time prices unless source contract/data supports it.

---

## Phase 6 Prompt — Commercialization

Implement:
- plans
- entitlements
- free/premium gates
- Apple subscription integration
- Google Play subscription integration
- web subscription architecture
- regional pricing
- restore purchase
- webhook/state reconciliation

Do not use a single USD-only price model.
