# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

**Lead persona — cross-border / multi-currency households.** Families whose members may
live in different countries and currencies (e.g. a worker in Saudi Arabia/SAR with family
in the Philippines/PHP) keeping one shared financial picture and reporting in a chosen
currency.

Also served — and the product must **not** be branded exclusively for any one of these:
individuals, couples, families, roommates, expats, migrant workers, OFWs, and co-located
shared households. Global from day one; explicitly not a U.S.-only product.

## Product Purpose

A global **household finance + shared-shopping** platform. One household maintains a single,
synchronized financial picture — income, expenses, transactions, budgets, bills/recurring
obligations, debt, savings goals — alongside shared grocery/shopping lists and retail
price/coupon intelligence, across members who use different devices, currencies, retailers,
branches, addresses, or countries.

Cloud data is authoritative: a change on one member's device reflects on the others, and a
lost or replaced device never means lost household data. Success is members in different
places trusting one shared, always-current view of their money and their shopping.

## Positioning

Not "just an expense tracker." The defensible combination a neighboring product cannot
truthfully copy piecemeal:

> household finance **+** real-time shared collaboration **+** shopping / basket intelligence
> **+** branch-level retailer pricing & coupons **+** first-class international multi-currency
> (cross-border, remittance, FX).

Core promise: *"One household, one synchronized financial picture — even when members use
different devices, currencies, retailers, branches, or live in different countries."*

## Operating Context

- Multiple household members on mixed devices — iPhone, iPad, Android phone/tablet, and
  installable Web/PWA on Windows/macOS — often at the same time; cloud-authoritative sync.
- Members may sit in different countries, timezones, and currencies; the household reports
  in one chosen currency.
- Real-world shopping: physical stores, **specific branches**, region-specific prices,
  coupons, loyalty pricing, and basket comparison.
- Per-household roles and permissions (owner / admin / member); all data household-scoped.
- Launch markets: US, Canada, Philippines, UK, Australia, Singapore, New Zealand, plus the
  GCC (Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman). Retail price coverage may be
  partial/beta per country while the finance/household platform is fully available.

## Capabilities and Constraints

**Capabilities (long-term functional areas):** authentication & security; household
membership & permissions; income; expenses; transactions; budgets; bills / recurring;
debt management; savings goals; shared grocery/shopping lists; retail product catalog;
branch-level retailer pricing; coupons / promotions / loyalty pricing; basket price
comparison; multi-currency households; FX history/snapshots; cross-border/OFW household
tracking (host-country income, home-country expenses, remittance / money sent home,
cross-border savings goals, household reporting currency); premium subscriptions; and
later, merchant/retailer integrations.

**Durable constraints future work must preserve:**

- **Money is exact.** Integer minor units + ISO currency code, never float; currency-specific
  exponent (JPY = 0, USD = 2, KWD/BHD/OMR = 3). Never mix currencies in one value or
  transaction. UI enters major units and converts at the screen boundary.
- **Security lives in the database (RLS), not the UI.** Every table is household-scoped; the
  client is never the security boundary.
- **Globalization is not optional.** Country, currency, language, timezone, tax assumptions,
  date formats, and text direction are never hard-coded.
- **i18n parity.** All UI copy is `t('...')` keys present in English / Filipino (Tagalog) /
  Arabic with matching key sets. More languages later.
- **RTL is first-class.** Arabic requires real right-to-left readiness; layouts must not
  assume LTR.
- **Adaptive platform, single design language.** One React Native / Expo codebase renders
  iOS, Android, and Web/PWA from a shared design system — it does **not** fork its design
  language per OS. No dedicated native desktop app for MVP; installable Web/PWA covers
  Windows/macOS.
- **Retail data must be authorized / licensed / permitted.**
- **Regional subscription pricing.** Support local/regional currencies and platform regional
  pricing; never USD-only. Allow purchasing-power / local-market pricing later — not
  mechanical FX conversion as the only strategy.
- **Price freshness must be visible; store/branch matters.**

**Explicitly undecided (do not fabricate):** the public product name/brand.

## Brand Commitments

- **No confirmed public brand name yet** — an open decision; future work must not invent one.
  Internal codename: *"Global Household App."*
- **Incumbent design-direction codename:** *"Ledger & Remittance"* — money-teal brand,
  remittance-gold accent, warm-paper canvas, white cards (per `components/theme.ts`).
  Recorded here only as the existing visual world; all visual decisions belong to later
  impeccable commands, not to this product record.
- Voice / personality: not yet formally established.

## Evidence on Hand

- Product-intent specs at repo root: `00_README_START_HERE` … `08_DEVELOPMENT_PHASES`
  (notably `01_MASTER_PROJECT_CONTEXT`, `04_DATABASE_MONEY_MULTICURRENCY_SPEC`,
  `05_GLOBALIZATION_MARKETS_OFW_SPEC`, `06_RETAIL_PRICE_COUPON_ENGINE_SPEC`).
- Working implementation: Phases 1–8 built and verified (per `CLAUDE.md`); design system in
  `components/theme.ts` + `components/ui/`; locales in `locales/{en,fil,ar}.json`.
- **No** real customers, testimonials, benchmarks, pricing figures, or press are confirmed —
  future work must not fabricate them. Regional subscription prices are a documented
  requirement, not yet decided numbers.

## Product Principles

1. **Global from day one** — currency, language, locale, timezone, and direction are data,
   never baked-in assumptions.
2. **One household, one synchronized truth** — cloud-authoritative; every member sees the same
   current picture across devices and countries.
3. **Money is exact and never mixed** — integer minor units + ISO code; correctness over
   convenience.
4. **Security by database policy** — RLS is the boundary, not the interface.
5. **MVP simplicity over premature enterprise complexity** — ship the shared, correct, global
   core before breadth.

## Accessibility & Inclusion

- **RTL / Arabic is a first-class requirement**, not an afterthought.
- **Multilingual parity** (English / Filipino / Arabic) is required for all UI copy.
- No formal WCAG level is set in the reviewed docs — treat standard mobile/web accessibility
  as the working floor and record a specific standard here when the team commits to one.
