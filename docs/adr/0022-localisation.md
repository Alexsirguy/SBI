# 0022. Localisation: typed messages in the app, language passed to the lesson writer

- Status: accepted
- Date: 2026-11-03
- Issue: #107

## Context

Spec §14 Phase 4 asks for localisation, with one more language end to end. The owner chose Spanish. All web text was hardcoded English, and every lesson request said `locale: "en"`. The lesson page's JavaScript budget (`e2e/budgets.spec.ts`) has almost no room left. An i18n library's client runtime and message bundles would not fit.

## Decision

- **No i18n library in the browser.** Messages are JSON files per area and language in `apps/web/app/i18n/messages/<lang>/`.
  - Spanish is typed against English, so a missing key fails the build.
  - The root layout loads only the chosen language on the server and passes it to an `I18nProvider`. It travels as page data, never in the JavaScript bundle.
  - Components use `useT(namespace)`, and server components use `getT(namespace)`. Placeholders are `{name}`.
- **Choosing the language:** the `sbi_locale` cookie, set by the switcher in the footer. Without it, the first supported language in the browser's `Accept-Language`, else English. URLs don't carry the language, so links and saved lessons work in any language. `<html lang>` follows the choice.
- **Lessons are written in the learner's language.** The page sends its locale with every lesson and question request.
  - For non-English locales, `languageRule` adds one instruction to the draft, model-knowledge, question and repair prompts. For English it adds nothing, so English prompts and their prompt versions are unchanged, and reuse still matches.
  - Reuse already filters by locale, so a Spanish request is never served an English lesson.
- **Everything the server writes for the learner follows the request's locale:** safety redirects and age holds (`@sbi/safety`), safety and review notices (`@sbi/orchestrator`), progress lines and lesson errors (`apps/api`), and the fallback questions (`@sbi/contracts`).
- **Reading level** uses Fernández-Huerta for Spanish, on the same scale as Flesch, so the floors are unchanged.

## Consequences

- Adding a language means one more messages folder, a Spanish-style text table in each server package, and a readability formula.
- Text from the model about a recognised object, and catalogue labels, may still be English until the catalogue is translated (#109 tracks coverage). API error messages outside lessons, such as uploads and accounts, are still English.
