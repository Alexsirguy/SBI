# 0019. Consent is asked per purpose, when it would do something

- Status: accepted, amended 2026-11-03 (every request can be answered) and 2026-11-04 (a fifth purpose, usage statistics, ADR 0026)
- Date: 2026-11-02
- Issue: #70

## Context

Spec §12 requires separate opt-ins for saving photos, account linking, model improvement and research. Consent must not be bundled, and nothing may be trained on photos without an affirmative yes. Today only saving photos has a feature behind it. There are no accounts, we never train models, and research use isn't built.

## Decision

- **Four purposes, all off:**
  - The contract (`ConsentRecord` in `@sbi/contracts`) has `save-photos`, `account`, `model-improvement` and `research`. Each starts off and is recorded separately with `CONSENT_VERSION` (`consent-1`) and the time it was decided.
  - A choice made under older wording counts as not given, so the learner is asked again.
- **Every request can be accepted or declined (owner's choice, 2026-11-03).** This replaces the first rule, "only purposes with a feature are asked for".
  - The privacy panel in the corner of every page, and "Your choices" on the privacy page, list all four requests. Each has its own Accept and Decline, with Accept all and Decline all given equal weight.
  - Nothing is blocked while a request is unanswered. An unanswered request is left out of `ConsentRecord.choices` and counts as declined. The collapsed tab shows how many are unanswered.
  - Model improvement and research say they are not used yet. An Accept is recorded so it can be honoured if they ship, and their wording is reviewed with a `CONSENT_VERSION` bump first.
  - Declining photos deletes every kept photo. Accepting the account link while signed in with a confirmed email links the device, and declining unlinks it.
  - In the child pathway, any Accept first passes the grown-up check; a Decline never waits.
- **Saving photos is asked at the moment it matters.**
  - After recognition, the learner sees a quiet "Keep this photo" button. It opens a plain explanation, and the photo is kept only when they press "Keep it".
  - A learner who already accepted keeps the photo in one press, except in the child pathway, which still asks.
  - A kept photo stays until the learner deletes it (owner's choice).
- **The consent version is recorded with what it allows:**
  - `POST /photos/keep` requires `consentVersion`, and `media_objects.consent_version` stores it.
  - A tutor turn kept for research must carry the consent version it was kept under.
- **Choices and kept photos live on the device.** With no accounts, the browser holds the consent record and the list of kept photos (`localStorage`). The privacy page's "Your choices" lists them, with Delete per photo. Withdrawing deletes every kept photo, not just future ones.
- **Deletion is immediate.**
  - `POST /photos/delete` removes the bytes and the registry row at once, and audits the deletion as "deleted at the learner's request".
  - A photo that is already gone counts as deleted.

## Consequences

- If browser data is cleared, the device forgets its kept photos. They stay in storage with no way to delete them from the app. Accounts (a later, separate opt-in) will fix that. Until then, the keep explanation says that only this device can find the photo again.
- Changing the wording of a choice means bumping `CONSENT_VERSION`.
