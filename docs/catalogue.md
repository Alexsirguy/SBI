# Growing the catalogue

Any subject can be taught (ADR 0013). The catalogue adds care on top: names we recognise in photos, related words for search, concepts for "Next concepts" (ADR 0024), and, for some entries, checked facts or a safety notice. The public `/support` page shows it, along with how many subjects have been taught on demand.

## What to add next

Run:

```sh
pnpm --filter @sbi/api catalog:priorities
```

It ranks what learners wanted that the catalogue doesn't know yet. It adds together:

- **catalogue gaps:** recognition labels and "tell us what you notice" terms that matched nothing (`catalog_gaps`, aggregated counts only);
- **on-demand subjects:** subjects with lessons, but no catalogue entry (`lessons.taxonomy_id` starting `subject.`).

Wordings that name the same thing ("car engine", "truck engine") are grouped by their last word. Anything the catalogue already resolves is left out.

The list holds learners' own words, so it stays with maintainers. The public page shows only counts.

## Adding an entry

1. **Decide where it goes.** If it's another name for an existing entry, add an alias (see `object.light-bulb`). Otherwise add an `object(...)` to `packages/taxonomy/src/seed.ts` under the closest category, with aliases, keywords and concepts.
2. **Name it in Spanish** in `packages/taxonomy/src/labels-es.ts`. A test fails if any entry is missing.
3. **Add a safety notice for a risky object** to `SAFETY_NOTICES` in `apps/api/src/lesson/lesson.service.ts` and to `SAFETY_NOTICES_ES` in `lesson-text.ts`.
4. **Facts are optional.** Lessons find their own evidence (ADR 0016). To curate facts, add them and run `pnpm --filter @sbi/api source:facts`.
5. **Rerun the priorities.** The entry should drop off the list.
