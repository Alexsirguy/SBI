# 0020. Optional accounts: email and password or Google, 13 and over

- Status: accepted
- Date: 2026-11-02
- Issue: #102

## Context

Spec §3 and §14 Phase 4 add optional accounts, and every lesson must still work without one. ADR 0019 left a gap: a kept photo can only be found through the browser that kept it. We first tried Auth0. The owner then chose to run accounts ourselves, with email and password plus Google, and asked that Google sign-in never navigate away from the page. Learners include children, and keeping a child's name and age needs verifiable parental consent under 13 (COPPA, UK GDPR).

## Decision

- **13 and over only.** Sign-up asks for first name, last name, age, email and password, or for name and age after Google. Under 13 is refused on the device and again by the API, and nothing about the child is stored. Younger learners use everything without an account.
- **Passwords** are hashed with `node:crypto` scrypt (N=2^17, r=8, p=1). The parameters are stored with each hash, so they can be raised later.
  - Passwords must be 10 to 128 characters, and common ones are refused. There are no character-mix rules (NIST 800-63B).
  - A wrong password and an unknown email get the same message and take the same time.
  - Guessing is rate-limited per email and per client.
- **Sessions** are a random token in an `HttpOnly; SameSite=Lax` cookie, marked `Secure` in production. It lasts 30 days.
  - Only its SHA-256 is stored, so a database copy cannot sign anyone in.
  - CORS allows credentials only for `WEB_ORIGINS`.
  - A cookie-carrying POST from any other `Origin` is refused.
- **Google** uses Google Identity Services' button with `ux_mode: "popup"`, so the page never navigates.
  - The button returns an ID token. The API checks its signature, issuer, audience, expiry and `email_verified` with `jose`. Only the client ID is needed, not a secret.
  - A Google email that matches an existing account joins that account. If that account's email was never confirmed, its password and sessions are removed, because Google has just proved who owns the inbox.
- **Email** goes through ZeptoMail and carries only one-time links: confirm your email (24 hours) and reset your password (1 hour). Only the hashes of these links are stored.
  - Asking for a reset never reveals whether the address has an account.
  - A reset signs out every session.
  - Without `ZEPTOMAIL_TOKEN`, links are written to the API log for local development.
- **Linking a device** (ADR 0019's `account` choice) needs a confirmed email, so nothing is tied to an address someone else might own.

## Consequences

- We now hold names, emails and ages, so the retention table and the launch review list them. Export and deletion come in #105.
- Google and ZeptoMail are new processors.
- Phone sign-in is left out. Adding it needs an SMS provider.
- Rate limits are per process (`TODO(#120)`), as elsewhere in the API.
