# ADR 0003 — Phase 2 auth & household RLS

- **Status:** Accepted
- **Date:** 2026-08-12

## Context

Phase 2 must guarantee household isolation ("Household A cannot read/write B")
enforced by the database, plus a first auth method. The project's Supabase has
only email auth enabled; SMS/OAuth/passkeys need external (some paid) setup.

## Decisions

1. **RLS everywhere, membership-derived.** Every household table has RLS; access
   is decided by `household_members`, never by a client-supplied `household_id`.
2. **SECURITY DEFINER helper functions** (`is_member_of`, `has_role_in`,
   `shares_household_with`) do the membership checks. This avoids infinite
   recursion that occurs when a `household_members` policy queries
   `household_members` under RLS.
3. **Atomic RPCs** `create_household` and `accept_invitation` (SECURITY DEFINER)
   handle the chicken-and-egg cases (you can't insert your own first membership
   under RLS) and validate invitation email/expiry server-side.
4. **Last-owner guard** via a trigger — a household can never lose its last owner.
5. **Email/password first**; other methods deferred to later slices pending
   provider configuration.
6. **Invitations are tokened rows, not emails yet.** Transactional invite email
   is a later Edge Function; for now the inviter shares the token and the
   invitee accepts it while signed in with the invited email.
7. **`typedRoutes` experiment disabled.** Its generated href types were
   unreliable in this setup (stale/malformed unions after adding route groups).
   Runtime is unaffected; can be revisited when the feature stabilizes.
8. **Supabase client left schema-agnostic**; the data layer (`features/*/api.ts`)
   casts results to the domain types in `lib/database.types.ts` at the boundary.

## Consequences

- Isolation is verifiable with a two-user integration test
  (`tests/integration/rls-isolation.mjs`, `npm run test:rls`).
- `lib/database.types.ts` must be kept in sync with migrations by hand until the
  Supabase CLI type generation is wired up.
- Invite UX requires manual token sharing until the invite-email function lands.
