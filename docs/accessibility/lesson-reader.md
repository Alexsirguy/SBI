# Lesson reader accessibility

Issue #65, epic #58. Target: WCAG 2.2 AA.

## What the automated checks cover

Each check runs in CI on every pull request (`apps/web/e2e`).

| Check                                                                                                                                                                                   | Where                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| axe (WCAG 2.0–2.2 A/AA and best practice) is clean                                                                                                                                      | `lesson.spec.ts` and `lesson-accessibility.spec.ts`: loading, ready, error, citations, depth and age, check your thinking, feedback, and forced colours |
| The whole lesson is usable from the keyboard alone: section list, check your thinking, citation markers, rating radios with the arrow keys, and submit                                  | `lesson-accessibility.spec.ts`                                                                                                                          |
| Every kind of control shows an outline of at least 2px when focused                                                                                                                     | `lesson-accessibility.spec.ts`                                                                                                                          |
| Colour is never the only signal: observation and explanation, claim status and notices are also written out in words, checked under forced colours                                      | `lesson-accessibility.spec.ts`                                                                                                                          |
| Outline: one `main`, one `h1`, a named section list, a "Before you read" notice region, and one named region per module. Citation markers are announced as "Source n: title", not "[n]" | `lesson-accessibility.spec.ts`                                                                                                                          |
| While the lesson loads, placeholders are hidden from assistive technology, and the section list says "(loading)"                                                                        | `lesson-accessibility.spec.ts`                                                                                                                          |
| Progress and "Lesson ready." are announced through one polite status; failures come through an alert with "Try again"                                                                   | `lesson.spec.ts`                                                                                                                                        |
| Placeholder animation stops under `prefers-reduced-motion`                                                                                                                              | `globals.css`                                                                                                                                           |

Re-checked on the Workbench polish (epic #253, 2026-10-30). All of the above pass on the polished screens. `budgets.spec.ts` adds layout checks at 360, 768 and 1280px, 44px touch targets and reduced motion. `screenshots.spec.ts` guards the look in light and dark, on phone and desktop.

## Manual screen-reader test

Automated checks cannot judge how the lesson sounds, so a person runs this script before each release that changes the reader. Use the mocked lesson (`pnpm --filter @sbi/web test:e2e` fixtures) or any real lesson.

Combinations:

- VoiceOver with Safari on macOS
- NVDA with Firefox on Windows
- VoiceOver with Safari on iOS (touch)

Steps, with what should be heard:

1. **Open a lesson link.** The page title and "Lesson: <object>" heading are read. While it loads, the progress status is announced politely, without interrupting.
2. **Wait for the quick answer.** It's announced as a "Quick answer" region. Focus is not moved.
3. **Notices.** The "Before you read" region reads any safety notice first, then the general-knowledge note, each with "Safety:" or "Note:".
4. **Headings rotor or list (VO+U, NVDA H).** You hear the h1, then "Quick answer", then the eight module headings in order, then "Sources" and "Tell us what you think".
5. **Landmarks.** You hear main, "Lesson sections" navigation, "Before you read", and one region per module.
6. **Section list.** Pick a section. The reading position moves to that section's heading.
7. **A module.** Its label is read with its kind ("What you can observe" or "Explanation"), then the text. How the parts work reads as a numbered list.
8. **Citation marker.** It's read as "Source 1: <title>, link", and activating it moves to that source in the list. Status labels such as "Based on limited evidence:" are read before the claim.
9. **Check your thinking.** The field label and the hint ("no score and no timer") are both read. After "Compare with the explanation", the explanation is read and focus is on it.
10. **Depth and age band.** The "How deep?" group and the "Age band (optional)" select are read with their current value. Changing either loads the new version, and "Lesson ready." is announced.
11. **Feedback.** Each 1–5 scale is read as a group with worded points ("4 Mostly"). Sending is confirmed by "Thanks…". Sending a report with no category is announced as an alert.
12. **Read aloud** (iOS Spoken Content or a browser's read-aloud). Prose reads without stray symbols; markers are skipped or read as their source names.

## Results

| Date | Tester | Screen reader / browser | Result      | Issues raised |
| ---- | ------ | ----------------------- | ----------- | ------------- |
| —    | —      | —                       | Not yet run | —             |

Add a row per run. Any failure becomes an issue under epic #58 and blocks the reader's phase gate.
