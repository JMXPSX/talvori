# features/

Feature-based organization (see `context/architecture.md`).

Each domain gets its own folder containing its screens' logic, hooks, schemas
(`schemas.ts` using Zod — see `lib/validation.ts`), and data access. Routes in
`app/` stay thin and delegate here.

Planned folders (created as each phase is built — **not** in Phase 1):

| Folder            | Phase | Purpose                                             |
| ----------------- | ----- | --------------------------------------------------- |
| `auth/`           | 2     | registration, login, OTP, MFA, biometric unlock     |
| `household/`      | 2     | households, members, invitations, roles, RLS access |
| `finance/`        | 3     | accounts, transactions, budgets, goals, debts, FX   |
| `shopping/`       | 4     | grocery lists, realtime sync, expense conversion    |
| `retail/`         | 5     | products, stores, prices, coupons (UI over services)|
| `subscription/`   | 6     | plans, entitlements, regional pricing               |

Nothing here has business functionality yet — Phase 1 is foundation only.
