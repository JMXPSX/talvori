# Talvori — Claude Code handoff

Drop this whole folder into your repo (or point Claude Code at it) and start with **`TALVORI_MOBILE_UI_SPEC.md`**.

## Suggested first prompt for Claude Code

> Read `TALVORI_MOBILE_UI_SPEC.md` in full, then open `reference/Flow Prototype.dc.html` in a browser and walk every flow it describes. Build the app in <your stack> following the spec section by section in the order given in §9, starting with §2 foundations. The screenshots in `screens/` are the visual source of truth; §7 lists zero-value and empty states that must exist in a fresh install. Do not port the prototype's HTML. Ask me before inventing any screen, field or copy string that is not in the spec.

## What's here

| Path | Purpose |
| --- | --- |
| `TALVORI_MOBILE_UI_SPEC.md` | The build spec — tokens, patterns, navigation, data model, every screen, every empty state, build order, acceptance checklist |
| `screens/` | 38 screenshots, numbered in flow order (01 login → 38 profile) |
| `assets/talvori-mark.png` | Brand mark, transparent PNG 281×281 — source for header lockups, app icon and splash |
| `reference/Flow Prototype.dc.html` | The interactive prototype — behavior source of truth |
| `reference/currencies.js` | ISO-4217 table (code, name, symbol, decimals) to ship as the currency picker's data |
| `reference/support.js` | Prototype runtime only — **do not port** |

## Screen index

| # | File | Screen |
| --- | --- | --- |
| 01 | `01-login.png` | Login / brand lockup |
| 02 | `02-onboarding-step1.png` | Onboarding 1 of 2 — household + currency |
| 03 | `03-onboarding-step2-invite.png` | Onboarding 2 of 2 — invite code |
| 04 | `04-home-top.png` | Home — hero, scope, quick actions |
| 05 | `05-home-by-account.png` | Home — Recent + By account |
| 06 | `06-add-income.png` | Add income |
| 07 | `07-add-income-date-note.png` | Add income — date + note |
| 08 | `08-add-expense.png` | Add expense |
| 09 | `09-transfer.png` | Transfer money |
| 10 | `10-activity-top.png` | Activity — IN/OUT/NET |
| 11 | `11-activity-rows.png` | Activity — ledger rows |
| 12 | `12-budget-monthly.png` | Budget — monthly + safe to spend |
| 13 | `13-budget-categories.png` | Budget — category budgets + scope |
| 14 | `14-budget-goals.png` | Budget — savings goals |
| 15 | `15-budget-debts.png` | Budget — debts |
| 16 | `16-shop-list-top.png` | Shop — groceries budget + this week's list |
| 17 | `17-shop-list-items.png` | Shop — list items, buy again |
| 18 | `18-shop-list-purchased.png` | Shop — purchased section |
| 19 | `19-shop-trip.png` | Shop — start shopping |
| 20 | `20-shop-trip-running-total.png` | Shop — running total |
| 21 | `21-shop-finish-top.png` | Shopping complete — store |
| 22 | `22-shop-finish-record.png` | Shopping complete — record purchase |
| 23 | `23-more-hub.png` | More — profile card + Money & Household |
| 24 | `24-more-hub-app-account.png` | More — App & Account |
| 25 | `25-bills-top.png` | Bills — monthly recurring |
| 26 | `26-bills-rows.png` | Bills — rows + add bill |
| 27 | `27-household-top.png` | Household — members + invite |
| 28 | `28-household-roles.png` | Household — role permissions |
| 29 | `29-reports-top.png` | Reports — range, income/expenses, net |
| 30 | `30-reports-categories.png` | Reports — spending by category |
| 31 | `31-reports-budget-vs-actual.png` | Reports — budget vs actual |
| 32 | `32-settings-top.png` | Settings — currency, language, appearance |
| 33 | `33-settings-notifications.png` | Settings — notifications |
| 34 | `34-settings-security.png` | Settings — security & privacy |
| 35 | `35-help-faq.png` | Help — FAQ |
| 36 | `36-help-feedback.png` | Help — feedback + contact |
| 37 | `37-profile-top.png` | Profile — photo controls |
| 38 | `38-profile-plan-signout.png` | Profile — plan + sign out |

## Two things the spec deliberately does not do

- **No backend contract.** Everything is described as local state so the prototype's behavior is unambiguous. Wire your own persistence/API behind the same shapes in §5.
- **No fake capability.** Passcode/biometrics, data export, account deletion, billing and support chat are specified as UI + state only, with copy that admits what isn't wired. Implement them for real or keep the honest copy — do not fake them.

Related: `../design_handoff_ux_overhaul/` holds the earlier package (32-finding audit, findings deck, redesign mockups, phased build prompt) if you want the reasoning behind these decisions.
