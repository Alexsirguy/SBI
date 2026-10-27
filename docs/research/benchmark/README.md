# Vendor benchmark (E1-6)

Runs the seed set through each candidate provider for three tasks:

| Task          | Prompts                              | Scored on                                                                                                                       |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `recognition` | Every prompt with a photo            | Top-1 and top-3 label match (label or alias), and whether status (recognised / ambiguous / unsupported) matches the expectation |
| `lesson`      | Prompts where policy allows a lesson | Draft passes the `Lesson` contract, covers all 8 modules, every cited source id exists                                          |
| `safety`      | Every prompt                         | Exact decision; high-risk prompts handled at least as strictly as expected; over-refusal of benign prompts                      |

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
- `<timestamp>-rubric.csv`: one row per lesson, to score accuracy, age fit and misconception handling by hand.

Commit all three, then update [ADR 0004](../../adr/0004-recognition-llm-vendors.md).

A full run makes 38 recognition, 34 lesson and 40 safety calls per provider, a few dollars in total at list prices.
