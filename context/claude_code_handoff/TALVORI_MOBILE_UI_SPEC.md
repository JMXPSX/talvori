# Talvori — Mobile UI Build Spec

**For:** Claude Code (or any implementer) building the Talvori mobile app from the approved design.
**Status:** approved design. Everything in this file is a requirement unless marked `(prototype-only)`.
**Companion files in this folder:**

| Path | What it is |
| --- | --- |
| `screens/*.png` | 38 screenshots — the visual source of truth. Every screen section below names its shots. |
| `assets/talvori-mark.png` | The brand mark (281×281, transparent PNG). |
| `reference/Flow Prototype.dc.html` | The running click-through. Open it in a browser and walk the flows before writing code. Behavior beats prose: if this file and the spec disagree, the prototype is right. |
| `reference/currencies.js` | The full ISO-4217 currency table the prototype uses (code, name, symbol, decimals). Ship this data. |
| `reference/support.js` | Runtime for the prototype only — **do not port**. |

**Do not port the prototype's HTML/CSS.** It is a behavior and layout reference. Build native (React Native / Expo) or whatever the target stack is, using the tokens in §2.

---

## 1. Product in one paragraph

Talvori is a **household** money app: one plan shared by several people. A user belongs to one or more households; each household has its own currency, budgets, transactions, bills, goals, debts and grocery list. The core loop is **plan before you spend**: set category budgets funded by named accounts → record income and expenses → plan groceries against the remaining grocery budget → shop → record the actual purchase, which flows back into the budget. Tagline: **"One plan. Everyone. Together."**

Five bottom-nav tabs, no more: **Home · Budget · Activity · Shop · More**.

---

## 2. Brand & design tokens

### 2.1 Identity
- **Name:** Talvori. **Wordmark:** lowercase `talvori`, Plus Jakarta Sans 800, letter-spacing −0.02em, navy ink.
- **Tagline:** `One plan. Everyone. Together.` — uppercase, letter-spacing 0.18em, purple, only on brand surfaces (splash, login, marketing). Never inside the app chrome.
- **Mark:** `assets/talvori-mark.png`. Sizes in use: 17px (inline), 34px (screen headers), 52px (login lockup), 78px (marketing).
- **App icon / splash:** the mark centered on a navy `#0F172A` rounded tile, mark at ~62% of the tile width. Export the standard iOS/Android icon set plus a splash at the same construction.

### 2.2 Color tokens
Name them in a theme file; **no component may hard-code a hex.**

| Token | Hex | Use |
| --- | --- | --- |
| `ink` | `#0F172A` | Primary text, dark surfaces, app icon ground |
| `primary` | `#6D4CFF` | Primary buttons, active nav, hero cards, links, accent type |
| `primaryPressed` | `#5A38E8` | Pressed/hover state of primary |
| `primaryTint` | `#EDE7FF` | Selected chips, icon tiles, soft fills |
| `primaryTintSoft` | `#F4F0FF` | Lowest-emphasis purple fill |
| `info` | `#3B82F6` | Informational bars, insight accent stripe |
| `infoStrong` | `#1D4ED8` | Info text on tint (AA) |
| `infoTint` | `#EAF2FE` | Info strip / transfer row backgrounds |
| `positive` | `#14B8A6` | Income, positive balances, on-track meters, goal reached |
| `positiveStrong` | `#0E9384` | Positive text at small sizes (AA) |
| `positiveTint` | `#D6F5F0` | Income row tiles |
| `warn` | `#F59E0B` | Shopping accents, goal progress, meters at ≥80% |
| `warnStrong` | `#B45309` | Warn text at small sizes (AA) |
| `warnTint` | `#FDE6C8` | Soft warn fill |
| `danger` | `#DC2626` | Validation errors, overdue, over-budget, destructive text |
| `dangerTint` | `#FEE2E2` | Error banner background |
| `dangerBar` | `#FFB4AB` | Over-budget meter fill |
| `textSecondary` | `#475569` | Labels, meta, helper text |
| `textTertiary` | `#94A3B8` | Chevrons, disabled |
| `border` | `#E2E8F0` | Input and card borders |
| `divider` | `#EDF1F7` | Row dividers |
| `fill` | `#F1F5F9` | Neutral tiles, inactive chips |
| `fillSoft` | `#F8FAFF` | Inline editor panels |
| `surface` | `#FFFFFF` | Cards |
| `background` | `#F6F7FB` | App background |

Contrast rule: use `positiveStrong` / `warnStrong` / `infoStrong` for text under ~14px; the base tones are for fills, bars and large numbers.

### 2.3 Type — Plus Jakarta Sans only (400/500/600/700/800)

| Role | Size / weight | Notes |
| --- | --- | --- |
| Screen title | 20–22 / 800 | "More", "Our Grocery List" |
| Screen subtitle | 12.5 / 400, `textSecondary` | One line under the title |
| Hero number | 26–34 / 800, −0.5px tracking | Money |
| Card title | 15 / 800 | "Recent", "Category budgets" |
| Section label | 10.5 / 700, 0.06em, uppercase, `textSecondary` | "MONEY & HOUSEHOLD", "PURCHASED" |
| Row title | 13.5–14 / 700 | |
| Row meta | 11–11.5 / 400, `textSecondary` | |
| Field label | 11.5 / 700, `textSecondary` | Above inputs |
| Button label | 12.5–14.5 / 700–800 | |
| Helper / legal | 10.5 / 400, `textSecondary`, line-height 1.5 | |

### 2.4 Shape, elevation, spacing
- **Radii:** card 20, hero 24, panel/inline editor 12–14, input 8–12, button 12–14, pill/chip 999, avatar 999, icon tile 10–12.
- **Shadow:** cards `0 4px 20px rgba(0,0,0,0.04)`; hero and popovers `0 8px 28px rgba(0,0,0,0.08)`. Nothing else gets a shadow.
- **Screen padding:** 20px horizontal, 16px top, 24px bottom above the nav.
- **Card padding:** 16px; grouped list cards use `4px 16px` so the first/last row divider breathes.
- **Gaps:** 12px between cards, 8–10px between chips, 10–14px between form groups.
- **Row height:** ≥44px tappable. Icon-button targets are 26–34px visually with a ≥44px hit area.
- **Bottom nav:** white, 1px top divider, `12px 8px 22px` padding, 10.5/600 labels, active item `primary`, icons `⌂ ◔ ≡ 🛒 •••` (replace with Lucide: home, pie-chart, list, shopping-cart, more-horizontal).

---

## 3. Global patterns (build these once)

1. **Card** — white, radius 20, shadow-sm, 16 padding.
2. **Grouped rows card** — icon tile 34 + title/subtitle + `›` chevron, 1px divider between rows, **no divider after the last row** (no empty space where a removed row used to be).
3. **Inline editor panel** — `fillSoft` background, 1px `border`, radius 12, opened *under* the row it edits (never a modal). Contains its fields, an inline error line, then `Save` (primary pill) · `Cancel` (outlined pill) · flex spacer · destructive text action on the right.
4. **Two-tap destructive confirm** — the destructive label reads `🗑 Delete` / `Delete`; first tap changes it to `Tap again to confirm`; second tap performs it. Reset on cancel/navigation. No alert dialogs.
5. **Chip row** — pill 8×14, selected = `primary` fill + white text + a leading `✓ `, unselected = `fill` + ink. Chips wrap.
6. **Toggle** — 42×24 track, radius 999, 20px white knob; on = `primary`, off = `#C7C4D7`.
7. **Segmented control (2 up)** — two equal pills, active = `primary` fill + white, inactive = white + 1px `border` + ink. Exactly one active.
8. **Select** — native picker styled: white, 1px `border`, radius 8–10, 12.5/700. The shown value must always equal the stored value (see §5.6).
9. **Meter** — 6–8px track `fill`, radius 999, fill color by state (`positive` <80%, `warn` ≥80%, `dangerBar` ≥100%), width animates 0.4s ease.
10. **Toast** — one line, appears on the screen the action lands on, auto-dismiss (2.5s info / 4s money). Green tint `#EDF3F0` + `positiveStrong` text for success. Never a blocking dialog.
11. **Inline validation** — 11.5/600 `danger` text inside the panel/form that caused it, cleared on the next keystroke. Never a toast, never silent.
12. **Empty state** — one sentence in 12/400 `textSecondary` that says what to do next, in place of the rows. Never an empty card, never a spinner-as-empty.
13. **Avatar** — circle; photo if the profile has one, else initials (max 2 chars, uppercase) on `primaryTint` with `primary` text; the signed-in user's own avatar in headers is `primary` fill + white text at 42px.

---

## 4. Navigation map

```
Splash → Login ──────────────────────────────────────────────┐
  └ (new user) Onboarding 1 of 2 → 2 of 2 ──────────────────►│
                                                             ▼
                                    ┌──────────────────── Home (tab)
                                    │  ├ household switcher (popover)
                                    │  │   ├ Create household (inline)
                                    │  │   ├ Join with a code (inline)
                                    │  │   └ Manage household → More▸Household
                                    │  ├ Income / Expense / Transfer (form screen)
                                    │  ├ All transactions → Activity
                                    │  └ By account row ✎ (inline editor)
                                    ├ Budget (tab): monthly, categories, goals, debts
                                    ├ Activity (tab): ledger, ✎ → form screen
                                    ├ Shop (tab): List ⇄ Start shopping → Shopping complete
                                    └ More (tab)
                                        ├ Profile (also via avatar + profile card)
                                        ├ Bills & Subscriptions
                                        ├ Household → member → Profile (read-only)
                                        ├ Reports & Insights
                                        ├ Settings
                                        └ Help & Support
```

Rules:
- Every More child screen has a `‹` back affordance at the title, returning to More. **More stays the active tab** on all of its children.
- Tapping the already-active More tab returns to the More hub.
- The transaction form screen returns to wherever it was opened from (Home or Activity).
- Switching tabs or households never resets in-progress data (see §5.7).

---

## 5. Data model & invariants

Field names are suggestions; the semantics are not.

### 5.1 Entities
```
userProfile   { id, name, email, photoUrl, photoZoom, photoX, photoY }
household     { id, name, currency, code, memberIds[], crossBorder:boolean }
membership    { householdId, userId, role: 'owner' | 'member' }
account       { name, openingBalance }                  // per user, NOT per household
transaction   { id, kind, name, category, account, amount, date, note }
                kind ∈ income | expense | transfer | goal | debt
                transfer stores account as "From → To"
categoryBudget { name, limit, account }                 // account = funding account
goal          { id, name, target, saved, history[{date, amount}] }
debt          { id, name, balance, due, history[{date, amount}] }
bill          { id, name, amount, freq, due, category, account, kind, active, note }
                freq ∈ Monthly | Weekly | Biweekly | Quarterly | Yearly
                kind ∈ bill | subscription
groceryItem   { id, name, qty, unit, price?, note?, status, addedBy }
                status ∈ need | cart | purchased
                unit ∈ each|pack|lb|oz|kg|g|L|mL|gallon|dozen
trip          { id, store, estimatedTotal, actualTotal, account, date, expenseTransactionId }
priceHistory  { [itemName]: lastUnitPricePaid }
```

### 5.2 Money invariants — these are the product
1. **One ledger.** Every money movement is a `transaction`. Shop, goals and debts must not keep separate ledgers.
2. **Budgets are per category AND per funding account.** A budget names the account that pays it. The Home hero and Budget screen have an account scope selector that filters **both** halves of the ratio — spend from that account against budgets funded by that account. Checking and Savings are never silently combined.
3. **Payroll is not an account.** Salary is income *into* Checking or Savings; its origin is the `Salary` category.
4. **Transfers** carry a neutral sign, are excluded from budget spend and from In/Out/Net, and count on **both** legs in per-account figures. The To-account picker excludes the current From account; changing From auto-moves a colliding To.
5. **Goal contributions and debt payments** post read-only transactions (`🎯 <goal> contribution · Goal`, `🧾 <debt> payment · Debt payment`), append to that goal/debt's own history, count as Out on their account, and are **excluded from category budget spend** (saving is not spending). They are not editable from Activity.
6. **Only income and expense rows are editable** from Activity (`✎`); other kinds show no edit affordance.
7. **Adding a grocery item never creates an expense.** Money moves only at **Record purchase**, which creates exactly one expense.
8. **Renames cascade.** Renaming an account updates every transaction (both legs of transfers), every budget's funding account, and the scope selector. Renaming a category updates existing transactions and the category pickers. Deleting an account re-points its budgets to the first remaining account; deleting a category is blocked if it is the last one.
9. **Select options must always contain the stored value** — build option lists as the union of the canonical list and any value already stored, or the picker will silently show something the record doesn't hold.

### 5.3 Accounts
Seed two: `Checking`, `Savings`, each with an editable **opening balance**. Users rename them to real banks ("BOA Checking", "Chase Savings"), add more, and delete down to a floor of two (transfers need a pair). A displayed balance = opening balance + this period's movements. Accounts belong to the **person**, so they persist across household switches.

### 5.4 Households
- The user starts with exactly **one** household — the one named at onboarding. **Never seed a second fake household.**
- **Create household**: name + reporting currency → user becomes Owner, a new invite code is generated, and the household **starts empty** (no transactions, budgets, bills, goals, debts, or grocery items). Land on Home with a toast pointing at adding income or a budget.
- **Join with a code**: valid code → user is added as Member and switched into that household, which arrives with **its existing shared data**. Invalid code → `No household found for <CODE>. Check the code with whoever invited you.` Already a member → `You're already in that household.`
- Switching households swaps the whole data bundle **and the currency**, and resets transient UI (open editors, shop mode, budget scope).
- Owner = first member id; Owner can manage the household, invites and budgets. Member can add income/expenses, view shared budgets, use the grocery list, see household activity. Owners may **view** another member's profile photo but never change it.

### 5.5 Currency & formatting
- Reporting currency is per household, chosen from the full ISO-4217 list (`reference/currencies.js`) with a search field and a worldwide shortlist surfaced first.
- Format with the currency's own symbol and decimal count: 2 decimals for USD/EUR/PHP-style, **0 for zero-decimal currencies** (JPY, KRW, VND, IDR…). Thousands separators per locale.
- Signs: income `+`, expense/goal/debt `−`, transfer no sign.
- **Nothing in the UI may be hardcoded to one country.** Store names are free text. No retailer list, no US-only defaults beyond the initial currency suggestion.

### 5.6 Dates
- Transaction date is `Today` / `Yesterday` / a custom date (native date picker). Store an ISO date; display short (`Aug 26`).
- Bill due dates: within 7 days or overdue render `danger` with the day count; undated bills sort last, read `no date set`, and are never announced as "next due".
- Report ranges: `This month` · `Last month` · `Last 3 months` · `Custom` (two dates + Apply). Opening the custom panel **seeds both inputs from the currently effective range** every time.

### 5.7 State preservation
Navigating between tabs and in and out of More must not reset: transactions, budgets, accounts and balances, grocery list and trip progress, household selection, currency, goals, debts, bills, profile, or report range.

---

## 6. Screens

Each screen lists its screenshots, its parts top-to-bottom, exact copy, and its zero/empty behavior. **Copy in `backticks` is literal.**

### 6.1 Splash *(new — not in the prototype)*
Navy `#0F172A` ground, mark centered, `talvori` wordmark in white beneath it, tagline in `primary` under that. No spinner text.

---

### 6.2 Login — `screens/01-login.png`
- Brand lockup: mark 52px, `talvori` 30/800, tagline 10.5/700 uppercase `primary`.
- Title `Welcome back` (24/800). Sub `One household, one financial picture — on every device.`
- **Email** — label `Email`, placeholder `you@example.com`.
- **Password** — label `Password`, placeholder `••••••••`, masked.
- Row: `Show password` / `Hide password` (left) · `Forgot password?` (right, `primary` 600).
- Error banner (`dangerTint`): `That email doesn't look right — try name@example.com` when the typed email lacks `@`.
- Primary button `Sign in`; while submitting the label becomes `Signing in…` and the button is inert (~700ms).
- Divider with `or`.
- `Continue with Google` (white + border) and `Continue with Apple` (ink fill).
- Footer: `New here? ` + `Create an account` (primary, 700).
- **Routing:** returning user with a household → Home. New user / no household → Onboarding.
- **Zero state:** empty fields are allowed to submit in the prototype only; in production require both fields and show `Enter your email and password.`

---

### 6.3 Onboarding — `screens/02-onboarding-step1.png`, `screens/03-onboarding-step2-invite.png`
Two steps, two progress dots (filled = done), label `Step 1 of 2` / `Step 2 of 2`.

**Step 1 — `Set up your household`**
- `Household name`, placeholder `e.g. Miller Family`. Empty on submit → `Name your household.`
- `Reporting currency`: search input (placeholder `Search 170+ currencies`), a shortlist of common currencies first, then the full list. Each row: symbol tile, code (14/800), name, `✓` when selected. Default selection = device locale's currency if known, else USD.
- `Continue`.

**Step 2 — `Invite your household`**
- Sub: `Everyone sees the same lists and budgets, live. You can also do this later.`
- Invite card: label `INVITE CODE`, the code (28/800, 0.14em, `primary`), buttons `Copy code` (tint) → `✓ Copied` for 1.5s, and `Share…`.
- Confirmation strip: `✓ <household> created · <CURRENCY>`.
- `Go to my dashboard` (primary) and `Skip for now` (text).
- Helper: `Members in another country? Turn on cross-border tracking any time in Household settings.`
- No cross-border step. The `crossBorder` flag lives in Household settings; when on, Home's hero gains a `Sent home this month` row.

---

### 6.4 Home — `screens/04-home-top.png`, `screens/05-home-by-account.png`

**Header**
- Greeting `Good morning` (+ `, <first name>` when known).
- **Household pill**: `<household> · <CURRENCY> ▾` — opens the switcher popover.
- Avatar (44px hit area) → Profile.

**Household switcher (popover card)**
- Section label `YOUR HOUSEHOLDS`; one row per household: name, `N member(s) · code <CODE>`, `✓` on the active one. Tapping switches (see §5.4).
- `＋ Create household` → inline panel: name input, `Currency` select, helper `Starts empty — its own budgets, transactions, bills and grocery list.`, `Create` / `Cancel`. Errors: `Name the household.` / `You already have a household with that name.`
- `Join with a code` → inline panel: code input (uppercased as typed, placeholder `Invite code — e.g. WVH-5570`), `Join` / `Cancel`.
- `Manage household` → More ▸ Household.

**Hero card (`primary` fill, radius 24)**
- Top row: `Spent in <Month>` (13/600, 85% opacity) and an **account scope select** (white pill): `All accounts` + one option per account.
- Big spent amount (34/800).
- Caption: `All accounts`, or `From <account> only — budget counts categories paid from it`.
- Meter + `<pct>% of <budget> budget` and `<n> days left`.
- When `crossBorder`: divider then `Sent home this month` + amount.
- **Zero state:** with no budget set, show `—` for the ratio and `Set a budget` as a link to Budget instead of a meter. With no spend, amount is the zero-formatted value (e.g. `$0.00`), meter at 0%, caption unchanged.

**Quick actions (3 equal tiles)** — `Income` (`positive` circle, `↙`), `Expense` (`primaryTint` circle, `↗`), `Transfer` (`primaryTint` circle, `⇄`). Exactly three; no Compare tile.

**Recent card** — title `Recent`, right link `All transactions →`. Up to 3 newest rows (see §6.6 row anatomy). **Empty:** `No transactions yet — add income or an expense to get started.`

**By account card** — title `By account`, right meta `balance · opening + this month`. One row per account: name (+ ` ● in view` when it is the current scope), balance (14/800, `danger` if negative), `✎`. Tapping the **row** focuses that account in the hero scope; tapping the focused row returns to `All accounts`.
- `✎` opens the inline editor: `Account name` + `Amount`, helper `Amount is this account's opening balance — income, expenses and goal/debt movements adjust it.`, `Save` / `Cancel` / `🗑 Delete` (two-tap). Errors: `Give the account a name.` / `"<name>" already exists.` / `Keep at least two accounts (transfers need both).`
- `＋ Add account` (dashed outline row) → same fields.

*(prototype-only: the dark "End of the prototype flow" card at the bottom of Home — do not ship.)*

---

### 6.5 Transaction form — `screens/06-add-income.png`, `07-add-income-date-note.png`, `08-add-expense.png`, `09-transfer.png`
One screen, four modes.

| Mode | Title | Save label | Save color | Category? | Second account? |
| --- | --- | --- | --- | --- | --- |
| income | `Add income` | `Save income` | `positive` | yes | no |
| expense | `Add expense` | `Save expense` | `primary` | yes | no |
| transfer | `Transfer money` | `Save transfer` | `primary` | **no** | yes |
| edit | `Edit transaction` | `Save changes` | by kind | as kind | as kind |

Parts:
1. `‹` back + title.
2. **Amount** — currency symbol (22/800 `textSecondary`) + borderless numeric input, 30/800, placeholder `0.00` (or the currency's zero form). Decimal keypad.
3. **Account** — label `To account` for income, `From account` otherwise; chip row.
4. **To account** (transfer only) — chip row in `warn`-toned selection, excluding the From account.
5. **Category** (not transfer) — chip row from the household's budget categories.
6. **Date** — segmented `Today` · `Yesterday` · `Custom`; Custom reveals a native date input. The chosen date shows in the saved row's meta.
7. **Note** — single line, placeholder `Optional note`. If filled it becomes the transaction's display name; otherwise the name is the category (or `Transfer`).
8. **Save** button.
9. **Edit mode only:** `🗑 Delete transaction` (two-tap) below Save.

Validation: `Enter an amount greater than zero.`; transfer with equal accounts → `Pick two different accounts.`
On save: return to the originating screen with a toast, e.g. `✓ Expense saved — −$86.40 from Checking`, `✓ Transfer saved — $200.00 from Checking to Savings`, `✓ Changes saved — −$86.40`.

---

### 6.6 Activity — `screens/10-activity-top.png`, `screens/11-activity-rows.png`
- Title `All transactions`.
- Summary strip: `IN` (+, `positive`), `OUT` (−), `NET` (signed, colored) — transfers excluded from all three.
- **Row anatomy:** 38px icon tile + name (13.5/600) + meta `<category> · <account> · <date>` + amount (13.5/700, `positive` when income) + `✎` for income/expense only.
  Icon/tile by kind: income `↙` `positiveTint`/`positiveStrong`; expense `🛒` `primaryTint`/`primary`; transfer `⇄` `infoTint`/`infoStrong`; goal `🎯` `warn`/ink; debt `🧾` `#E8EFF1`/ink.
- Footer hint: `Tap ✎ to fix a wrong entry — amount, account, category, date — or delete it inside.`
- Success banners from Shop and forms render at the top of this screen.
- **Empty:** `Nothing here yet. Income and expenses you add will appear in this list.`

---

### 6.7 Budget — `screens/12-budget-monthly.png`, `13-budget-categories.png`, `14-budget-goals.png`, `15-budget-debts.png`

**Monthly budget card**
- `<amount> left` or `<amount> over` (21/800), sub `<spent> spent of <budget> · <n> days left`, then `Safe to spend <amount> / day` (`primary` 600). Meter as §3.9.
- **Zero state:** no categories → `No budget yet — add a category below to start tracking.`

**Category budgets card**
- Title `Category budgets` + account scope select (same options as Home; the two stay in sync).
- Caption: `All accounts` or `Showing categories paid from <account>`.
- Per category: name, right side `<amount> left` / `<amount> over` (colored) + `✎`; meter; sub `<spent> spent of <limit> · paid from <account>`.
- `✎` editor: `Category name`, `Limit`, `Paid from:` chip row, `Save` / `Cancel` / `🗑 Delete` (two-tap). Errors: `Give the category a name.` / `"<name>" already exists.` / `Enter a limit of 0 or more.` / `Keep at least one category.`
- `＋ Add category` → name + monthly limit + `Paid from:` chips.
- Default seed categories (US example): Groceries, Dining out, Transport, Utilities, Remittance home, Other. Seed limits are examples — the real app should start these at the user's own numbers, and a **category with limit 0 must render as `0% of $0.00` with a full-width neutral meter, not a divide-by-zero blank.**

**Savings goals card**
- Title `Savings goals`. Per goal: name, `<pct>%` (or `Reached 🎉` in `positive`), `warn` meter, `<saved> of <target>`, and `＋ Contribute` → inline amount + `Save`.
- Last 5 movements under the bar: `＋$50.00 · Aug 26`, in a `warn`-bordered rail.
- `＋ Add goal` → `Goal name` + `Target`. Errors: `Give the goal a name.` / `Enter a target greater than zero.` / `Enter a contribution greater than zero.`
- **Empty:** `No goals yet — add one and every contribution shows up here and in Activity.`

**Debts card**
- Title `Debts` + right meta `Total owed: <amount>`.
- Per debt: name, balance, due label (see §5.6), `Record payment` → inline amount + `Save`. History rail shows `−$100.00 · Aug 26`.
- Paying a debt to zero removes the row and shows `✓ <name> paid off 🎉` for 3s.
- `＋ Add debt` → `Debt name` + `Amount` + `Due:` date. Errors: `Give the debt a name.` / `Enter an amount greater than zero.` / `Enter a payment greater than zero.`
- **Empty:** `No debts tracked — add one to see due dates and progress.`

---

### 6.8 Shop — "Our Grocery List" — `screens/16-shop-list-top.png` … `22-shop-finish-record.png`

Shop is grocery **planning against the budget**, not price comparison. `priceComparisonEnabled = false` for V1: keep the concept possible (offers/stores can return later as "Compare prices — Beta") but ship **none** of its UI.

**Header** — `Our Grocery List` (22/800), sub `<household> · Shared`, avatar right.

**Groceries budget card** — `<Category> budget` + month; rows `Monthly budget` / `Spent this month`; meter; `Remaining` + amount (16/800). Hidden entirely when the household has no grocery-ish category.

**This week's list card (`primaryTint`)** — `This week's list`, `N items remaining`, right `Estimated` + total (22/800); white strip `After this trip` → `≈ <amount> left` (`positive`, or `danger` when it would go over); then the segmented control `List` | `Start shopping`. Exactly one section visible at a time.

**Insight strip (`infoTint`, 3px `info` left border)** — `Your usual grocery trip is <avg>. This week's list is about <diff> higher/lower.` / `…is about the same.` Hidden when there is no history or no estimate.

**List mode**
- Card title `Your list` + `＋ Add item`.
- `BUY AGAIN` chips from purchase history — tapping adds the item at its last paid price.
- Add form: `Item name` + `Qty` + unit select; `More options` reveals `Note (optional)` + `Est. price`; `Add to list` / `Cancel`; helper `Estimated price is optional — we'll use the last price you paid when we know it.`
- Item row: name; meta `<qty> <unit>[ · note]`; right `Est. <amount>` or **`no estimate`** in `textSecondary`; under it a 16px `addedBy` avatar + first name. When the item has no manual price but history exists: `Last paid <amount> · ` + `use as estimate` (tappable).
- Row `✎` editor: name, qty, unit, `Est. price per <unit> (optional)`, `Save` / `Cancel` / `🗑 Remove`. Errors: `Give the item a name.` / `Quantity must be greater than zero.` / `Estimated price must be 0 or more.`
- `PURCHASED` section (only when non-empty): green `✓` tile, struck-through name, `<qty> <unit> · paid <amount>`, plus `Clear purchased` and helper `Clearing keeps the prices you paid, so future lists estimate themselves.`
- **Empty list:** `Nothing on the list yet — add an item or tap one under Buy again.` and `Start shopping` shows `Add something to the list before you shop.` if pressed.

**Start shopping mode** — `screens/19-shop-trip.png`, `20-shop-trip-running-total.png`
- Card head `Shopping trip`, sub `N of M items left`, right `<Category> left` + remaining budget.
- Row: 24px checkbox (checked = `positiveStrong` fill + `✓`, name turns `positiveStrong`), name, meta `<qty> <unit> · est. <amount>`, and an **optional** price input whose placeholder is the estimate.
- `Running total` strip (`primaryTint`, 17/800) = sum of checked items, using typed prices where given, estimates otherwise.
- Helper: `Prices are optional while you shop — check items off and enter the real total at the end.`
- Buttons: `Finish shopping` (`warn` fill, ink text) and `Back to list` (neutral — returns to List mode keeping every checkbox and typed price).

**Shopping complete** — `screens/21-shop-finish-top.png`, `22-shop-finish-record.png`
- `‹` + `Shopping complete`.
- `Store` — **free text**, placeholder `Any store — e.g. SM Supermarket`; recent store names offered as chips below. Never a fixed retailer list.
- `Estimated total` (read-only).
- `Actual total paid` — big input, placeholder = the running total, so submitting unchanged is one tap.
- `Paid from` select (accounts).
- `Category` (the grocery budget's own name) and `Date` `Today`, both read-only rows.
- `Record purchase` (primary) + helper `This is the only step that creates an expense — it posts once to Activity, your <Category> budget, and the <account> balance.`
- On record: create **one** expense named after the store; save a `trip`; write each bought item's unit price into `priceHistory`; flip checked items to `purchased`; clear typed prices; return to **Activity** with `✓ Purchase recorded — −<amount> at <store> · <account>` for 4s.
- Validation: `Enter the amount actually paid.` if the field is cleared to zero/invalid.

---

### 6.9 More hub — `screens/23-more-hub.png`, `24-more-hub-app-account.png`
- Title `More`, sub `Manage your household and app.`, avatar top-right → Profile.
- **Profile summary card** (white, 1px border, radius 16): 40px avatar, name (15/800), `<household> · <plan>`, `›`. Whole row taps to Profile.
- Section `MONEY & HOUSEHOLD` — grouped card:
  - `Bills & Subscriptions` — `Recurring payments and due dates`
  - `Household` — `Members, invites and permissions`
  - `Reports & Insights` — `Spending, trends and cash flow`
- Section `APP & ACCOUNT` — grouped card:
  - `Settings` — `Currency, region, security and privacy`
  - `Help & Support` — `FAQ, feedback and support`
  - **No Profile row** — the summary card and the avatar are the two ways in. No divider or gap where it would have been.
- Footer: `App version 1.0 · Your financial data stays private`, centered 11/400.
- Exactly these six destinations; nothing that belongs to Home/Budget/Activity/Shop appears here.

---

### 6.10 Bills & Subscriptions — `screens/25-bills-top.png`, `26-bills-rows.png`
- `‹` + `Bills & Subscriptions`, sub `Stay ahead of recurring payments.`
- Hero (`primary`): `Monthly recurring` + amount, sub `N active bill(s) · next <name> <date>` — or `no dates set` when nothing is scheduled. **Monthly amount normalizes frequency** (weekly ×4.333, biweekly ×2.167, quarterly ÷3, yearly ÷12).
- Card `Upcoming` + `＋ Add bill`.
- Add/edit form: `Bill name`, `Amount`, frequency select (**`Monthly` first**), next due date, category select, paid-from account select, `Note (optional)`, `Add bill`/`Save` + `Cancel` (+ two-tap `🗑 Delete` when editing). Errors: `Give the bill a name.` / `Enter an amount greater than zero.`
- Row: name, meta `<Subscription|frequency> · <category> · <account>[ · note]`, amount, due label (`due Aug 30` / `overdue Aug 28` in `danger` / `no date set` / `paused`), `✎`, and `Pause` / `Resume`. Paused rows dim to `textTertiary` and sort last; undated bills sort after dated ones.
- Helper: `Bills are reminders — paying one still goes through Expense so your accounts stay accurate.`
- **Empty:** hero shows the zero-formatted amount and `0 active bills · no dates set`; the card shows `No bills yet — add one to see what's due.`
- Architecture must also allow: recurring **income**, and active/inactive status (already present).

---

### 6.11 Household — `screens/27-household-top.png`, `28-household-roles.png`
- `‹` + `Household`, sub `People who share this budget.`
- Card: household name (16/800), `N active member(s) · <CURRENCY>`, and an `Invite` button (toggles to `Close`).
- Invite panel: `INVITE CODE`, the code, `Copy code` → `✓ Copied`, `Share…`.
- Member rows: avatar, `<name>` + ` (you)` for self, role line `Owner · Full access` / `Member · Shared budget`, and a badge pill `Owner` (`primaryTint`) / `Member` (`fill`). Tapping a row opens that member's Profile.
- Card `What each role can do`: **Owner** — `Manage the household, invite or remove members, edit budgets and shared settings.` **Member** — `Add income and expenses, view shared budgets, use the grocery list, see household activity.`
- The member count **must derive from the roster it displays** (never a stored number).
- Cross-border toggle lives here (`Members in another country?`) and drives Home's `Sent home this month` row.

---

### 6.12 Reports & Insights — `screens/29-reports-top.png`, `30-reports-categories.png`, `31-reports-budget-vs-actual.png`
- `‹` + `Reports & Insights`, sub `Understand where your money is going.`
- **Range control:** pills `This month` · `Last month` · `Last 3 months` · `Custom`; a date pill showing the effective range opens a panel with two date inputs + `Apply`, seeded from the effective range every open. Error: `Start date must be on or before the end date.`
- Two cards side by side: `Income` (`positive` figure) and `Expenses`.
- `Net cash flow · <range>` card (`primary`): signed amount + `You're keeping <pct>% of income in this period (<range>).` / `You spent <amount> more than you earned in this period (<range>).` / `No income recorded in this period — add one to see your savings rate.`
- `Spending by category` — bar per category (widths relative to the largest), `<pct>% of its <limit> budget` or `no budget set`; over-budget bars turn `danger`. Budget comparisons in multi-month ranges scale the limit by the number of months.
- `Budget vs actual` — `<category>` · `<spent> / <limit>` · `<amount> left` or `<amount> over` (colored, no-wrap column).
- **Empty:** `No expenses recorded in this period — pick another range or add one.`
- Architect for later: month-over-month, trends, per-member spending. No charting library required — clear numbers and simple bars.

---

### 6.13 Settings — `screens/32-settings-top.png`, `33-settings-notifications.png`, `34-settings-security.png`
- `‹` + `Settings`, sub `Customize how the app works.`
- Grouped card:
  - `Currency & region` — `Reporting currency, country, formats` → right value `<CUR> · <Country>`.
  - `Language` — `More languages coming` → `English`.
  - `Appearance` — three equal pills `System` · `Light` · `Dark`; Light is the shipped default. Picking another stores the preference and notes `<X> theme is saved as a preference — the visual theme ships with the design-system update.`
- Section `NOTIFICATIONS` — five toggles, each with a sub-line: `Bill reminders` (`3 days before a due date`, on), `Budget alerts` (`When a category passes 80%`, on), `Household activity` (`When a member adds a transaction`, on), `Savings goals` (`Milestones and contributions`, **off**), `Shopping list updates` (`When someone edits the list`, on).
- Section `SECURITY & PRIVACY`:
  - `App passcode` — `Ask for a code when opening the app`, toggle; turning on notes `Passcode on — you would set a 4-digit code here.` **Do not fake biometrics** — wire real platform biometrics or omit.
  - `Export my data` — `CSV of transactions and budgets` → confirmation `Export queued — a CSV of transactions and budgets would download here.` (implement for real: CSV of transactions + budgets).
  - `Delete account` — `Removes your data permanently`, destructive two-tap. In the prototype it is inert and says so; production must really delete after a typed confirmation.
- Confirmation messages render as a green strip at the bottom of the screen.

---

### 6.14 Help & Support — `screens/35-help-faq.png`, `36-help-feedback.png`
- `‹` + `Help & Support`, sub `Get help when you need it.`
- `Frequently asked questions` — accordion rows (`⌄`/`⌃`), one open at a time. Ship these four:
  1. `Does adding to the grocery list spend money?` — no; money moves only at Record purchase, which posts one expense.
  2. `Why is my budget split by account?` — each category names its funding account; the scope selector filters spend and limits together.
  3. `How do goals and debts show up?` — read-only Activity rows plus per-goal/debt history, excluded from category spending.
  4. `Can I use this outside the US?` — any reporting currency; stores and prices are the user's own.
- `Send feedback` — `Suggest an improvement — it goes to the product team.`, textarea placeholder `What would make this app better?`, `Send`. Empty → `Write a note first.`; success → `✓ Thanks — feedback sent.`
- `Contact support` — `Email support@example.com and we usually reply within a day. Live chat is not wired up in this prototype.` Replace the address and the honesty caveat when a real channel exists; **never imply a backend that doesn't exist.**

---

### 6.15 Profile — `screens/37-profile-top.png`, `38-profile-plan-signout.png`
- `‹` + `Profile`, sub `Your personal account.`
- **Photo block (centered):** 88px avatar — the photo, else initials.
  - No photo → `Upload Photo`. With a photo → `Change Photo` and, under it, `Remove Photo` (`danger`), stacked and visually secondary to the name.
  - Picking a file opens a **crop panel**: 116px circular preview, `Zoom`, `Horizontal`, `Vertical` sliders, `Save photo` / `Cancel`. Keep it simple — no full editor.
  - `Remove Photo` → confirm `Remove profile photo?` / `Your initials will be shown instead.` / `Cancel` · `Remove`.
  - Success strips: `✓ Photo saved`, `✓ Photo removed — showing initials`.
- Name (17/800) + email under the avatar block.
- `PERSONAL INFORMATION` — `Name` and `Email` inputs + `Save`. Errors: `Name cannot be empty.` / `That email looks wrong.` Success `✓ Saved`.
- `Subscription plan` — right value `<plan>`; three pills `Personal` · `Premium` · `Household`; helper `Billing isn't connected in this prototype — switching plans only changes what the app shows.` Architect for Free/Premium/Household; **no billing APIs yet.**
- `Sign out` — white card with border, `danger` text, centered, separated from the fields above.
- **Viewing another member** (from Household): the photo controls, personal info, plan and sign-out are replaced by a `Household role` card plus `Only <first name> can change this photo.`
- **One photo per user.** The same `userProfile.photoUrl` drives: More avatar and profile card, Home and Shop headers, Household roster, member profile, grocery `added by` mini-avatars, and any future collaboration surface. Removing it restores initials **everywhere**.

---

## 7. Zero-value, placeholder and empty-state inventory

Build these explicitly — they are part of the design, not fallbacks.

| Surface | When | Must show |
| --- | --- | --- |
| Home hero | no budget | `—` ratio + `Set a budget` link, no meter |
| Home hero | no spend | zero-formatted amount, 0% meter, caption unchanged |
| Home Recent | no transactions | `No transactions yet — add income or an expense to get started.` |
| Home By account | new account | its opening balance, even when 0 |
| Transaction form | untouched | amount placeholder `0.00`, note placeholder `Optional note`, date `Today` preselected |
| Activity | no rows | `Nothing here yet. Income and expenses you add will appear in this list.` + zeroed IN/OUT/NET |
| Budget monthly | no categories | `No budget yet — add a category below to start tracking.` |
| Category budget | limit 0 | `0% of <zero amount>`, neutral full-width meter (never NaN/blank) |
| Category budget | scope filters everything out | `No categories paid from <account> yet.` |
| Goals | none | `No goals yet — add one and every contribution shows up here and in Activity.` |
| Goals | target reached | `Reached 🎉` in `positive`, meter full |
| Debts | none | `No debts tracked — add one to see due dates and progress.` |
| Debts | paid off | row removed + `✓ <name> paid off 🎉` |
| Shop budget card | no grocery category | hide the card entirely |
| Shop list | empty | `Nothing on the list yet — add an item or tap one under Buy again.` |
| Shop item | no price, no history | `no estimate` in `textSecondary` (not `$0.00`) |
| Shop item | no price, history exists | `Last paid <amount> · use as estimate` |
| Shop estimate | all items unpriced | zero-formatted estimate + `After this trip` unchanged |
| Shop insight | no trip history | hide the strip |
| Shop purchased | none | hide the section and `Clear purchased` |
| Shop trip prices | untouched | placeholder = that item's estimate |
| Shop finish | actual untouched | placeholder = running total; submitting uses it |
| Bills hero | none | zero amount + `0 active bills · no dates set` |
| Bills list | none | `No bills yet — add one to see what's due.` |
| Bill row | no due date | `no date set`, sorted last, never "next due" |
| Household | single member | `1 active member` (singular) |
| Switcher row | single member | `1 member · code <CODE>` (singular) |
| Reports | no income in range | `No income recorded in this period — add one to see your savings rate.` |
| Reports | no expenses in range | `No expenses recorded in this period — pick another range or add one.` |
| Reports | category with no budget | `no budget set` |
| New household | just created | every list empty with its empty state + toast pointing at income/budget |
| Profile | no photo | initials avatar + `Upload Photo` |
| Any list | loading | skeleton rows at the real row height — never a centered spinner, never a layout jump |

---

## 8. Accessibility & platform

- Touch targets ≥44px; icon buttons get padded hit areas.
- Text contrast: body copy ≥4.5:1 (use the `*Strong` tones on tints); large numbers and chrome ≥3:1.
- Every icon-only control needs a label (`Edit <name>`, `Remove photo`, `Toggle <notification>`).
- Support Dynamic Type / font scaling: no fixed-height text rows; long translated strings must wrap, not clip (the design is built for RTL and longer languages — use logical properties / `start`/`end` insets, as the prototype does).
- No horizontal scrolling at 390pt width; chips wrap.
- Currency and date formatting go through the platform formatter with the household's currency and the device locale.

---

## 9. Build order

1. **Foundations** — theme tokens (§2), Plus Jakarta Sans, the §3 primitives, bottom nav, brand assets, splash, app icon.
2. **Auth + onboarding** — login, two-step onboarding, currency list from `currencies.js`.
3. **Money core** — data model (§5), accounts with opening balances, transaction form (4 modes), Activity, Home hero with account scope.
4. **Budget** — monthly card, category budgets with funding accounts + scope, goals, debts, all posting to the one ledger.
5. **Shop** — grocery list, estimates from history, trip mode, Shopping complete → one expense.
6. **More** — hub, Bills, Household, Reports, Settings, Help, Profile with per-member photos.
7. **Multi-household** — switcher, create, join, per-household data bundles and currency.
8. **Polish** — every empty/zero state in §7, toasts, validation copy, accessibility pass.

### Acceptance checklist
- [ ] Every screen matches its screenshot in structure, order and copy.
- [ ] All §7 rows implemented and visible in a fresh install.
- [ ] The §5.2 invariants hold: one ledger; budgets scoped by funding account; transfers neutral and double-legged; goal/debt movements logged but out of category spend; grocery list creates no expense; renames cascade; pickers always contain the stored value.
- [ ] Switching tabs and households loses nothing (§5.7).
- [ ] Nothing is hardcoded to one country or retailer; a zero-decimal currency renders correctly throughout.
- [ ] More stays the active tab on all six of its children; each has a working back.
- [ ] One profile photo per user, reflected on every surface listed in §6.15.
- [ ] No dead buttons anywhere in these flows; anything unimplemented says so plainly.
