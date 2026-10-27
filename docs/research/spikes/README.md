# Feasibility spikes (E1-7)

Code lives in `packages/benchmark/src/spikes/`. Run:

```sh
pnpm --filter @sbi/benchmark spikes                      # offline spikes, plus live Wikipedia retrieval
pnpm --filter @sbi/benchmark spikes --llm meta-spark     # also the model-based cache and safety checks
```

Each run writes `<timestamp>.json` here.

| Spike        | Fixture                | What it does                                                                                                                                                                                                                             |
| ------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence     | `evidence-claims.json` | For 3 topics: retrieves each cited Wikipedia article, finds a passage supporting the claim, and builds `EvidenceSource` and `Claim` records validated by `@sbi/contracts`. A deliberately false control claim must come out unsupported. |
| Safety       | seed set 1.0.0         | A rule-based first pass over all 40 prompts. With `--llm`, also the model classifier from the benchmark's safety task.                                                                                                                   |
| Intent cache | `cache-pairs.json`     | 19 question pairs, scored on whether they share a cache entry. Signature = SHA-256 of taxonomy id, intent id, audience band and reading level. The keyword classifier runs offline; `--llm` classifies against the same intent catalog.  |
| Rights       | seed set 1.0.0         | Audits each seed image's rights record and sorts images into publishable versus internal-only.                                                                                                                                           |

The results and the Phase 0 verdict are in [../p0-go-no-go.md](../p0-go-no-go.md).
