# Progress Tracker

> The one **live** context file — update it after each work session. This repo-committed
> tracker is for humans and agents that don't load claude-mem; claude-mem (`MEMORY.md` + the
> observation DB) remains the richer cross-session memory. Seeded 2026-08-27 from current state.
>
> Current branch: `design/ibilly-adoption`.

## Completed

- [x] Phases 1–8 built and verified (foundation, auth+household+RLS, finance core, shared
      shopping, retail beta, commercialization 6a, globalization, QA/hardening).
- [x] RLS isolation drill green on the live backend (household isolation across every table).
- [x] Money/FX engine + tests; account deletion/export (incl. `protect_last_owner` cascade fix);
      forgot-password flow; app-wide guarded deletes; ActionSheet web fallback.
- [x] "ibilly / Expertly Approachable" design system + script-aware fonts + dashboard hero/donut.
- [x] UX overhaul A–F + retail follow-ups (4d Stores, 4e coupon→grocery matching, 5b branch
      picker, 2c rank-by-net Compare, segmented Shop hub). typecheck / ~192 tests / lint / web
      bundle green.
- [x] `context/` created from the JSM context-driven-dev structure (this migration).

## In progress

- [ ] Dark theme — initiated (needs a provider refactor; see "Up next" 4c).

## Up next (buildable now — no external blockers)

Ordered by priority. These are the only items that can be worked without new accounts or data.

- [ ] **4c dark theme — provider refactor** (highest-value unblocked item; already initiated).
- [ ] 4b onboarding (incl. cross-border "different countries?" question) — non-blocking polish.
- [ ] Apply migration `20260820000012` (5a retailer directory) in the Supabase SQL editor —
      small admin task (also tracked under Known issues).

## Blocked

| Item | Blocker |
|------|---------|
| 6b billing (Apple IAP / Google Play / Stripe-web + webhooks, regional pricing, restore) | Needs store/processor accounts. Writes the same `household_subscriptions` row via `source`. |
| 5d live retail (real connectors, Edge Function around `ingestFromConnector`, loyalty OAuth, global catalog) | Needs an authorized data source. Interface + mock connector + ingest pipeline already exist. |
| **Full-2c Shop tab** | Needs live multi-store pricing → depends on **5d**. Partial (segmented Shop hub + rank-by-net Compare) already shipped on manual/seeded data. |
| **5b branch-picker follow-ups** | Needs live branch data → depends on **5d**. Picker UI already shipped; branches stay household-created rows until connectors land. |
| Phase 9 Beta launch | Needs web host, Apple/Google dev accounts, Sentry, real Site URL. |
| Crash monitoring | Needs monitoring account (Sentry). |

## Known issues

| Issue | Severity | Status |
|-------|----------|--------|
| Migration `20260820000012` (5a retailer directory) must be applied by hand | Medium | Open — apply in Supabase SQL editor |
| Two diverged checkouts share the branch name (`C:\dev` vs OneDrive) — "canonical" ambiguous | Low | Open — OneDrive holds the newest work |

## Decisions made (don't re-debate)

- Money = integer minor units + ISO currency code; never float; never mix currencies.
- RLS is the security boundary, not the client. Every household table is `household_id`-scoped.
- Migrations are hand-authored and hand-applied; `lib/database.types.ts` synced by hand.
- i18n parity across en/fil/ar is enforced; RTL is first-class.
- Modular monolith for MVP; no microservices.
- 6a manual plan toggle is `__DEV__`-gated so it can't be a free-premium hole in prod.
- Design direction: "ibilly / Expertly Approachable" (Stitch-adopted), borderless white bento
  tiles on a cool blue-white canvas.

## Session notes

- **2026-08-27:** Adopted JS Mastery's context-driven-dev structure. Migrated the numbered
  `00_–11_` root specs into `context/` (9 files); domain specs (05 globalization/OFW, 06
  retail engine) absorbed into `architecture.md` + `project-overview.md`; the numbered originals
  were removed (recoverable from git history). `PRODUCT.md` → `product.md` and `DESIGN.md` →
  `design-proposal.md` (proposed vermilion redesign, not shipped) moved in; `docs/` deep archive
  (adr/, specs/, plans/, ORCHESTRATION) and the code READMEs (features/, supabase/) pulled under
  `context/` too — all project docs now live here. UI trio stays indigo ibilly (matches
  theme.ts).
- **2026-08-30:** Folded the 3 ADRs into a dated "Key decisions & rationale" log in
  `architecture.md` (and repointed `code-standards.md`); removed `context/adr/`. Then folded the
  17 specs + 8 plans into `build-plan.md` Appendices A/B (anchor forms `#spec-<stem>` /
  `#plan-<stem>`); removed `context/specs/` + `context/plans/` and repointed all references
  (incl. code comments in `theme.ts` + a migration). build-plan.md is now ~10.8k lines.
- **2026-08-30 (cont.):** Conformed `context/` to the JSM 9-file template: folded
  `design-proposal.md` (vermilion redesign) into `ui-tokens.md` as a labeled "NOT shipped"
  Appendix (pointers added from `ui-rules.md`/`ui-registry.md`), and folded `product.md` into
  `project-overview.md` (positioning, brand, accessibility, durable constraints, fuller
  principles). Both standalone files removed. `context/` core is now exactly the 9 template files
  + README + deep-reference (design/, ORCHESTRATION.md, features.md, supabase.md).
- **2026-08-30 (cont.):** Folded `features.md` (feature-module layout) into `architecture.md`
  as a "Feature modules" table (updated stale `shopping/`→`grocery/`, `subscription/`→`billing/`;
  dropped the stale "nothing built yet" line); removed the standalone file.
- **2026-08-30 (cont.):** Folded the `context/README.md` index into the root `README.md` as a
  "Project documentation" section (links rewritten to `context/…` paths); removed the standalone
  `context/README.md`. Repointed `CLAUDE.md` to start at `context/project-overview.md`. Root
  `README.md` is now the single doc entry point.
- **Decision (2026-08-30):** `ORCHESTRATION.md` stays **standalone** — it's a two-agent
  operating runbook (how to drive Terminal/Desktop), not product/codebase docs, so it doesn't
  map to any of the 9 template files. Don't fold it. `supabase.md` remains a fold candidate into
  `architecture.md`/`code-standards.md` if strict conformance is wanted later.
- **2026-08-30 (cont.):** Re-scoped "Up next" to only truly-buildable-now items (4c dark theme,
  4b onboarding, apply migration `20260820000012`); moved Full-2c Shop and 5b follow-ups into
  Blocked (both depend on 5d / an authorized data source). Next: resume dark-theme provider
  refactor.
