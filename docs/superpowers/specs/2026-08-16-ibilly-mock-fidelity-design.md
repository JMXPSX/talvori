# ibilly mock fidelity — slice E

Date: 2026-08-16
Branch: `design/ibilly-adoption`
Predecessor: `2026-08-15-stitch-design-adoption-design.md` (slices A–D)

## Why

Slices A–D moved the tokens, primitives, and screen layouts to the ibilly system: indigo
palette, Plus Jakarta Sans, borderless bento cards on soft ambient shadow, the desktop
sidebar, and the floating mobile tab bar. The app now uses the right colours and the right
containers.

It still does not look like the mocks. Comparing the five Stitch exports in
`stitch_universal_budget_tracker/` against the running app, the gap is no longer tokens —
it is **chrome and list idiom**:

- Every mobile mock has an app bar. The app has none; screens open on a bare title.
- The mocks' dominant list row is an icon-in-a-tinted-circle with an amount and a progress
  sub-line. The app's rows are plain two-line text.
- The mocks' period filters and income/expense bars have no counterpart at all.

This slice closes those three gaps on the five tab screens.

## Scope decisions

Four decisions were taken during brainstorming and constrain everything below.

**Visual language only.** The mocks depict a different product. Spendometer (a live
spend-rate gauge), Loyalty Cards, and Trophies are ibilly features with no analogue in this
app's domain. We adopt the mocks' *patterns* onto the screens that exist. We do not build
those three features, and we do not re-point the gauge at a substitute metric.

**App bar is mobile-only.** On wide layouts the sidebar already carries the wordmark,
household, and plan — the web mock has no top bar at all. Rendering one would produce a
double header that the web mock explicitly does not have.

**Gradients on data visualisation only.** `DESIGN.md` asks for a radial canvas wash and
gradient primary buttons as well. Both are declined: the wash is imperceptible at the
specified <5% opacity, and gradient buttons would touch every button in the app for no
gain over the flat indigo fill already shipped. `expo-linear-gradient` enters the project
for the flow bars alone.

**Five tab screens.** Dashboard, Transactions, Budget, Grocery, More. New primitives are
available app-wide; only these five are restyled now.

## Architecture

### The app bar splits container from presentation

`components/ui/` is presentational by convention — `SideNav` states this in its own header
("the caller maps navigation state into `items`"). A bar that reads `useActiveHousehold`
would give a UI primitive a feature-provider dependency, so it is two files:

- **`components/ui/AppBar.tsx`** — pure. Avatar (image URL, or initials fallback), centred
  title, optional right action. No provider imports.
- **`features/household/HouseholdAppBar.tsx`** — reads `ActiveHouseholdProvider`, feeds
  `AppBar`. Owns the avatar-press navigation to `/account`.

### `Screen` becomes the single tab-screen wrapper

`Screen` already owns safe area, canvas colour, desktop margin, and the content width cap.
The app bar is the missing piece of that same job.

```ts
export interface ScreenProps {
  title?: string;
  children?: ReactNode;
  centered?: boolean;
  /** Pinned above the scroll area. Rendered only on narrow layouts. */
  appBar?: ReactNode;
  /** Wrap children in a ScrollView. */
  scroll?: boolean;
}
```

The `appBar` node is rendered only when `useIsWideLayout()` is false, so the wide-layout
suppression lives in exactly one place and web cannot grow a second header from any call
site. `title` is retained unchanged; screens that pass an `appBar` pass no `title`, so
nothing doubles up.

Two tab screens (`budget`, `more`) already use `Screen` and only gain the prop. Three
(`index`, `transactions`, `grocery`) hand-roll `SafeAreaView` + `ScrollView` and are
migrated onto it. That migration is landed as its own commit, before any visual change.

### App bar contents per tab

| Tab | Left | Centre | Right |
|---|---|---|---|
| Dashboard | avatar → `/account` | household name | — |
| Transactions | avatar → `/account` | household name | `+` → income/expense/transfer ActionSheet |
| Budget | avatar → `/account` | household name | — |
| Grocery | avatar → `/account` | household name | `+` → new list |
| More | avatar → `/account` | household name | gear → `/account` |

The Budget tab carries no right action: it is a three-link navigation hub, and creating a
budget lives in `/finance/budgets`.

## New primitives

| Primitive | Shape | Consumers in this slice |
|---|---|---|
| `AppBar` | avatar / centred title / optional action | all five tabs, via `HouseholdAppBar` |
| `MetricRow` | tinted circular icon → label + amount, optional sub-line over a slim bar | dashboard accounts, transactions rows, grocery lists |
| `InsightCard` | full-bleed indigo, translucent circular icon badge, body copy, white CTA button | dashboard balance hero |
| `SegmentedControl` | `surfaceMuted` pill track, indigo thumb | dashboard Money Flow card |
| `FlowBar` | gradient-filled track, rounded caps, legend dot | dashboard Money Flow card |

All five are added to the existing `__DEV__` gallery at `app/dev/theme.tsx`, in both Latin
and Arabic, per the slice-B verification approach: the codebase has no screen rendering
tests, so the gallery is the only practical way to see transient states before shipping.

`Switch` is **not** built. The mocks show one on their settings screen, but its only
consumer in this codebase is `app/household/index.tsx`, which is outside the five tabs.
Building it now would ship a primitive whose sole caller we have agreed not to touch.

## The Money Flow summary card

`SegmentedControl` and `FlowBar` have no consumer among the five tab screens as they stand
— the mocks put both on a Money Flow screen this app does not have, and the dashboard shows
a category donut instead. Rather than ship two gallery-only primitives, the dashboard gains
the Money Flow summary card that the mobile mock shows below Budgeting:

- Week / Month / Year segmented control
- Income and Expense totals as gradient-filled bars with legend dots
- Net flow in the corner, signed

This is the one behavioural addition in the slice. It requires **no backend change and no
new query**: the dashboard already fetches `listTransactions` and `listLatestRates`, and
`TransactionWithRefs` carries `occurred_at`, direction, amount, and currency.

New pure module `features/finance/flow.ts`:

```ts
export type FlowPeriod = 'week' | 'month' | 'year';

export interface FlowSummary {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  currency: string;
  /** Currencies with no rate to the reporting currency; surfaced like the hero's hint. */
  missing: string[];
}

export function flowSummary(
  txns: readonly TransactionWithRefs[],
  period: FlowPeriod,
  now: Date,
  reporting: string,
  rate: (from: string, to: string) => number | null,
): FlowSummary;
```

The `rate` parameter is the return type of `makeRateLookup` in `features/finance/fxApi.ts`,
which is structural — there is no exported alias for it, and this spec does not add one.

`now` is a parameter rather than read inside, so the period-boundary tests are
deterministic. Conversion reuses `sumInReporting`'s rate lookup, and unconvertible
currencies are reported in `missing` rather than silently dropped — the same contract the
consolidated balance hero already honours. I/O stays in `api.ts`; this module imports no
Supabase client, which would break it under jest.

Unit tests mirror `tests/**` coverage of `donut.ts`: period boundaries (a transaction on
the first and last instant of each window), mixed currencies with a complete rate set,
mixed currencies with a missing rate, empty input, and income-only / expense-only inputs.

## Screen-level changes

**Dashboard** — migrated onto `Screen`. Balance hero becomes `InsightCard` (the free-tier
upgrade variant keeps its existing copy and target). Money Flow card added. Accounts rows
become `MetricRow` with an account-type icon and a `type · currency` sub-line. The
quick-action tile grid and the donut card are unchanged; both already conform.

**Transactions** — migrated onto `Screen`. Rows become `MetricRow` with the category icon
and a direction-coloured amount. Date grouping headers are unchanged. The existing
in-content `+` button is removed and its handler moves to the app bar's `+` action — it
opens the same income / expense / transfer `ActionSheet` it opens today, so behaviour is
unchanged and the affordance does not appear twice.

**Grocery** — migrated onto `Screen`. Rows become `MetricRow` with a cart icon, the list
name, and the currency code as the sub-line — **no progress bar**: `listLists` returns
plain `GroceryListRow[]` with no item counts, and this slice adds no query to obtain them.
The screen's existing in-content `+` button and its header row are removed; the app bar's
`+` action replaces them, so the affordance does not appear twice.

**Budget** — app bar only, no other change. The mock's ring-and-percentage budget rows
describe `/finance/budgets`, which is out of scope; this tab is a navigation hub and
`ListRow` is the correct idiom for navigation. Recorded here so that the Budget tab looking
unchanged is not later read as an oversight.

**More** — app bar with a gear action. Profile card and rows already conform.

## i18n

New keys added to `locales/{en,fil,ar}.json` together, as `tests/lib/i18n.test.ts` fails on
mismatched key sets:

- `finance.flow.title`, `.income`, `.expense`, `.net`
- `finance.flow.periods.week`, `.month`, `.year`
- `a11y.openAccount`, `a11y.addTransaction`, `a11y.addList`, `a11y.openSettings`

Arabic keeps Readex Pro throughout; the app bar is direction-aware via `lib/rtl.ts`, so the
avatar and action swap sides in RTL rather than being pinned left and right.

## Verification

- `npm run typecheck`
- `npm test` — including the new `flow.ts` suite; existing donut and component tests stay green
- `npm run lint`
- `/dev/theme` gallery: all five new primitives, Latin and Arabic
- Manual pass: narrow web, wide web, and device — confirming the app bar appears on narrow
  only, and that the sidebar has no bar above it

No table, policy, or RPC changes, so `rls-isolation.mjs` is unaffected and needs no new
assertion.

## Commit sequence

Structural before visual, so the reskin diff stays reviewable.

1. `refactor(ui)`: `Screen` gains `appBar` + `scroll`; migrate the three hand-rolled screens (no visual change)
2. `feat(ui)`: `AppBar` + `HouseholdAppBar`, wired into all five tabs
3. `feat(ui)`: `MetricRow`, `InsightCard`, gallery entries
4. `feat(finance)`: `flow.ts` + unit tests
5. `feat(ui)`: `SegmentedControl`, `FlowBar`, `expo-linear-gradient`, gallery entries
6. `feat(design)`: adopt the primitives into the five screens
7. `docs(design)`: record what shipped and any residual debt

## Out of scope

- **Spendometer, Loyalty Cards, Trophies** — ibilly features with no analogue in this app.
- **`Switch`** — no in-scope consumer.
- **Canvas gradient wash and gradient buttons** — declined; see Scope decisions.
- **Dark mode** — `DESIGN.md` ships a light-only palette, as in slice B.
- **Every screen outside the five tabs** — the finance, grocery, retail, and household
  stacks keep their slice-D treatment.
- **Renaming the app to "ibilly"** — Stitch's invented brand, not a decision taken here.
  Carried forward unchanged from the slice A–D spec.

## Reference material

The five Stitch exports live in `stitch_universal_budget_tracker/` at the repo root:
`ibilly_dashboard/`, `money_flow/`, `budget_settings/`, `ibilly_web_dashboard/`, and the
`reference.png/` marketing board, each with a `screen.png` and the generated `code.html`.
`ibilly/DESIGN.md` is the token source already adopted into `components/theme.ts`.

These are committed as design reference. The `code.html` files are Tailwind output from
Stitch and are **not** a source of truth for implementation — the app is React Native, and
the tokens in `components/theme.ts` supersede them.
