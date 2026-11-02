# 0020. Optional accounts through a managed OIDC provider

- Status: accepted
- Date: 2026-11-02
- Issue: #102

## Context

Spec §3 and §14 Phase 4 add optional accounts. Learners must be able to use everything without one. ADR 0019 left one gap: kept photos are found only through the browser that kept them, so clearing browser data leaves them unreachable. The owner chose a managed sign-in provider over running our own.

## Decision

- **Auth0, spoken to only as standard OIDC.**
  - The web app signs in with Authorization Code + PKCE (`@auth0/auth0-spa-js`), so no secret lives in the browser.
  - The API checks bearer access tokens with `jose`. It verifies the signature, issuer, audience and expiry against keys found through OIDC discovery.
  - Nothing outside `apps/web/app/account/session.ts` names Auth0, so another OIDC provider can replace it.
- **Off unless configured.** The API needs `AUTH_ISSUER` and `AUTH_AUDIENCE`, and the web app needs the three `NEXT_PUBLIC_AUTH_*` values. Without them, account routes answer 503 and the web app shows no account link.
- **We keep an opaque id, not a profile.** The `accounts` table stores the issuer, the subject and dates. Email and name stay with the provider.
- **Signing in and linking are separate choices.**
  - Signing in creates the account and nothing more.
  - Linking this device ties its kept photos to the account (`media_objects.owner_account_id`). It needs the `account` opt-in from ADR 0019 under the current consent version, and the API checks this.
  - Unlinking withdraws the opt-in. Photos stay kept but are no longer tied to the account.
  - A photo already linked to another account is never taken over.
- **The API stays stateless.** There are no cookies or server sessions. The browser keeps refresh tokens in `localStorage`, so sign-in survives reloads without third-party cookies. Auth0's refresh-token rotation limits what a stolen token can do.

## Consequences

- Auth0 becomes a processor of the email and name of learners who sign in. It must be listed in the launch review.
- Tokens in `localStorage` can be read by script on our origin, so the existing strict CSP and the absence of third-party scripts now matter for accounts too.
- Saving lessons (#103), sharing (#104), and export and deletion (#105) build on the account id.
