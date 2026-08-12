# supabase/

Backend workspace for the Supabase CLI (see `02` + `04` specs).

```
supabase/
  migrations/   # versioned SQL migrations — the ONLY way schema changes ship
  functions/    # Edge Functions for privileged/server-side work (FX, webhooks,
                # retailer normalization) — where third-party secrets live
```

## Rules

- **Every** schema change is a versioned migration. No ad-hoc SQL against prod.
- Household-owned tables carry `household_id` and are protected by **RLS**
  (`03_SECURITY_AUTHENTICATION_SPEC.md`). No production schema exists yet — it
  arrives with Phase 2 (auth/household) and Phase 3 (finance).
- Server secrets (service-role key, Stripe/SMS/FX/retailer secrets) live only in
  Edge Function secrets — never in the client or `EXPO_PUBLIC_*`.

## Local setup (when the backend work begins)

```bash
npm install -g supabase        # or use npx supabase
supabase init                  # if not already initialized
supabase start                 # local Postgres + Studio
supabase migration new <name>  # create a new migration
```
