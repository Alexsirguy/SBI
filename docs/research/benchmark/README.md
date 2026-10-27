# Vendor benchmark (E1-6)

Runs the seed set through each candidate provider for three tasks:

| Task          | Prompts                              | Scored on                                                                                                                                                                                                                                |
| ------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recognition` | Every prompt with a photo            | Top-1 and top-3 label match (label or alias), and whether status (recognised / ambiguous / unsupported) matches the expectation                                                                                                          |
| `lesson`      | Prompts where policy allows a lesson | Draft passes the `Lesson` contract, covers all 8 modules, every cited source id exists; it derives the answer (short answer second, basic truths before parts, ≥3 reasoning steps ending on "Put it together") and asks ≥3 valid guesses |
| `safety`      | Every prompt                         | Exact decision; high-risk prompts handled at least as strictly as expected; over-refusal of benign prompts                                                                                                                               |

All three report p50 and p95 latency and an estimated cost from the prices in `PROVIDERS`.

## Run

```sh
cp packages/benchmark/.env.example packages/benchmark/.env   # add META_MODEL_API_KEY and OPENAI_API_KEY
pnpm --filter @sbi/benchmark seed:fetch
pnpm --filter @sbi/benchmark bench --check-models --providers meta-spark,meta-wonder,openai-main,openai-mini
pnpm --filter @sbi/benchmark bench --providers meta-spark,meta-wonder,openai-main,openai-mini
```

Options:

- `--tasks recognition,lesson`
- `--limit 5` for a smoke run
- `--model openai-main=<id>` to try a different model id.

Each run writes three files here:

- `<timestamp>.json`: every record plus the summary
- `<timestamp>.md`: summary tables
- `<timestamp>-rubric.csv`: one row per lesson, to score accuracy, age fit, whether the reasoning steps really lead to the answer, and misconception handling by hand.

Since `lesson-p0.2` the model writes a lesson as steps (the prototype's first-principles format). Each step is tagged with a contract module, and a module's steps are joined into one `Lesson` section.

After a scorer fix, `pnpm --filter @sbi/benchmark rescore <path to run>.json` re-scores the stored outputs without new API calls.

Commit all three, then update [ADR 0006](../../adr/0006-recognition-llm-vendors.md).

A full run makes 38 recognition, 34 lesson and 40 safety calls per provider, a few dollars in total at list prices.
