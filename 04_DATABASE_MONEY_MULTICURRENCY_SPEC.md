# Database, Money & Multi-Currency Specification

## Money Rule — Critical
Never use binary floating-point types for persisted money.

Do NOT use:

```sql
amount FLOAT
```

Use integer minor units plus currency code.

Example:

USD $25.99
- `amount_minor = 2599`
- `currency_code = 'USD'`

JPY ¥500
- `amount_minor = 500`
- `currency_code = 'JPY'`

Currency metadata must understand currencies with 0, 2, or other minor-unit conventions.

## Do Not Hard-Code USD
Never hard-code:
- `$`
- `USD`
- two decimal places
- U.S.-only date/number formatting

## Original Currency Preservation
A transaction made in one currency must retain its original amount/currency.

If household reporting uses another currency, store conversion context without destroying the original transaction.

Recommended conversion metadata:
- original amount minor
- original currency
- reporting currency
- reporting amount minor
- FX rate used
- FX provider/source
- rate timestamp

Historical reporting should not silently change because today's exchange rate changed.

## Initial Conceptual Database Domains

### Identity / Household
- profiles
- households
- household_members
- household_invitations
- household_settings

### Finance
- accounts
- categories
- transactions
- transaction_splits
- budgets
- budget_allocations
- debts
- debt_payments
- savings_goals
- goal_contributions

### Currency
- currencies
- fx_rate_snapshots

### Shopping
- grocery_lists
- grocery_items

### Retail Intelligence
- retailers
- retailer_regions
- stores
- products
- product_variants
- retailer_products
- price_snapshots
- promotions
- coupons
- retailer_loyalty_connections (later/optional)

### Commercial
- plans
- subscriptions
- entitlements

### System
- audit_logs
- notifications
- attachments

## Household Ownership
Every household-owned table should carry `household_id` where appropriate.

Use foreign keys, indexes, and RLS policies intentionally.

## Auditability
Financial records should favor traceable updates rather than destructive silent mutation.

For sensitive financial actions, consider appropriate created_by/updated_by timestamps and/or append-style history where valuable.
