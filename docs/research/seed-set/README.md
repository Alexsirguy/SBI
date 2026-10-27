# Seed evaluation set

Versioned prompts used by the vendor benchmark (E1-6), the feasibility spikes (E1-7) and later the benchmark suite (E9). Validated by `SeedSet` in `@sbi/benchmark`.

## Versions

| Version | Path              | Prompts | Notes                               |
| ------- | ----------------- | ------- | ----------------------------------- |
| 1.0.0   | `v1/prompts.json` | 40      | Initial set for Phase 0 (issue #10) |
| 2.0.0   | `v2/prompts.json` | 40      | Current. Changes are listed below.  |

Changes in 2.0.0, found by the first vendor run:

- `seed-006` (swing): the photo showed a child's face, which breaks the no-faces rule. Replaced with an empty swing seat.
- `seed-008` (feather): the photo was an illustrated plate. Replaced with a photo of a single feather.
- `seed-022` (cactus): the photo was a botanical illustration. Replaced with a photo of a golden barrel cactus.
- `seed-009` (socket): added the alias "electrical outlet".
- Every image now records `peopleVisible` (`none` or `hands-only`), checked by hand on a contact sheet. A test rejects any other value.

Never edit a released version in place. Copy it to the next `vN/` folder, bump `version`, add it to `SEED_SET_PATHS`, and point `SEED_SET_PATH` at it. Old runs keep scoring against the version they used.

## What each prompt holds

- `category`: maths, physics, biology, chemistry or arts.
- `taxonomyId`, `label`, `aliases`: the answer a recogniser should reach. Any alias counts as correct.
- `question`: what the learner asked, written in their voice.
- `tags`:
  - `ambiguous-photo`: the photo could plausibly be several things; a good system asks instead of guessing.
  - `unsupported`: outside what the product should answer.
  - `misconception`: carries a common wrong belief in `misconception` that the lesson should address.
  - `high-risk`: safety policy must redirect or refuse.
  - `paraphrase`: same intent as `paraphraseOf`, used by the cache-match spike.
  - `text-only`: no photo; tests the question path alone.
- `expected.recognition` and `expected.safety`: what a good system does.

## Images and rights

Photos come from Wikimedia Commons (mostly Wikipedia lead images, chosen to avoid faces). Each has a rights record (source page, author, licence) and a pinned SHA-256.

Images are not committed. They are downloaded for internal evaluation only, never shown to learners or redistributed. Fetch and verify them with:

```sh
pnpm --filter @sbi/benchmark seed:fetch
```

Before an image is reused anywhere public (for example the prototype), it needs a CC0, public-domain or CC BY/BY-SA licence and a credit line.
