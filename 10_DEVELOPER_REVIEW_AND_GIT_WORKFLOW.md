# Developer Review, Claude Workflow & Git Rules

## Roles
Founder/Product Owner:
- owns product requirements and priority

Software Consultant/Developer:
- reviews architecture
- reviews security-sensitive changes
- reviews database migrations
- reviews production readiness

Claude:
- accelerates implementation
- proposes code
- writes tests/docs
- does not unilaterally redefine architecture

## Preferred Workflow

`Requirement -> technical design -> small Claude task -> code -> developer review -> tests -> commit -> next task`

## Claude Task Size
Prefer small bounded tickets.

Good:
- create household invitation migration + RLS tests
- implement email OTP login screen
- add grocery realtime subscription

Bad:
- build the entire production app
- rewrite the complete database and UI at once

## Git Practices
Recommended initially:
- `main` = protected/releasable
- short-lived feature branches
- pull requests for meaningful changes

Examples:
- `feat/auth-email-otp`
- `feat/household-rls`
- `feat/grocery-realtime`
- `fix/money-formatting-jpy`

## Commit Practices
Use small, descriptive commits.

Examples:
- `feat(auth): add email OTP verification flow`
- `feat(db): add household membership RLS policies`
- `test(money): cover zero-decimal currencies`

## Mandatory Review Areas
Developer review required for:
- authentication/security
- RLS
- database migrations
- money calculations
- FX handling
- payment/subscription integration
- retailer API/license behavior
- secrets
- data deletion/export

## Testing Gate
Do not merge high-risk changes without relevant tests.

## Architecture Decision Records
For major choices, record:
- context
- decision
- alternatives
- consequences

Examples:
- why modular monolith
- why integer minor units
- why Supabase Broadcast
- why retailer connectors
- why PWA before native desktop
