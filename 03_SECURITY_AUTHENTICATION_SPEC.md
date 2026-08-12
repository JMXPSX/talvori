# Security & Authentication Specification

Security is a first-class requirement because the application stores personal financial behavior and household information.

## Authentication Methods Required / Planned
- Email + password
- Email verification
- Email OTP
- SMS OTP
- Google Sign-In
- Sign in with Apple
- Authenticator-app MFA / TOTP
- Passkeys
- Face ID
- Touch ID
- Android fingerprint / biometric authentication
- Account recovery
- Session management
- Device/session visibility
- Sign out from other devices
- Rate limiting
- Security/audit events where appropriate

## SMS OTP
SMS OTP is an approved core requirement.

The business accepts legitimate SMS delivery costs.

Design for international telephone numbers from the beginning.

Do not assume U.S.-only numbers.

## Passkeys
Passkey support is part of the security roadmap and should not be architecturally blocked by early authentication decisions.

## Biometrics
Face ID/fingerprint should normally unlock or re-authenticate an existing valid device session, not become the sole cloud account identity.

Typical flow:

`cloud login -> valid session -> secure local storage -> subsequent app open -> biometric unlock`

Possible user-configurable auto-lock:
- Immediately
- 1 minute
- 5 minutes
- 15 minutes

Sensitive operations may require step-up authentication later, including:
- Changing household ownership
- Changing MFA/security settings
- Exporting sensitive financial records
- Deleting account
- Connecting financial institutions
- Other high-risk actions

## Household Roles
Do not use roles such as husband/wife.

Use generic authorization roles, initially:
- Owner
- Admin
- Member
- Viewer

## Database Security
Use PostgreSQL RLS.

The database must prevent Household A from accessing Household B.

Example principle:

A transaction may be read only if `auth.uid()` is an authorized member of the transaction's `household_id`.

## Secret Management
Never commit `.env` secrets.
Never expose privileged backend keys to the client.
Use secure server-side secret storage.

## Security Testing
Before handling real financial data, test:
- unauthorized household reads
- unauthorized writes
- invitation abuse
- role escalation
- session revocation
- lost/revoked device session
- OTP abuse/rate limiting
- MFA flows
- account recovery
- data export/delete permissions
