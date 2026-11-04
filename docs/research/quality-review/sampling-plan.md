# Scientific quality review: sampling plan (#80)

Experts can't read every lesson, so they read a sample drawn the same way each time. `sampleForReview` (`@sbi/evidence`) implements it, and `pnpm --filter @sbi/api ops:quality-sample [size] [seed]` draws one from the lessons learners can be served (approved or auto-validated).

## Who is in the sample

1. **Every high-safety-class lesson.** These are the ones where an error can hurt someone.
2. **The five most reused lessons.** An error in a reused lesson reaches every learner it's served to.
3. **An even draw across strata** of topic family (catalogue `object`, typed `subject`, and so on) × safety class, round-robin with a random member each time. Small strata still get read, and topics don't get swamped by the most common one.

The draw is seeded. Record the seed with the sample so anyone can draw it again and check it.

## How many, and how often

- **Monthly**, 30 lesson versions. That's about 3 hours for two reviewers.
- **Before a launch or a phase gate**, 60 versions. Each is read by two reviewers independently, then disagreements are discussed.
- Report agreement on critical findings (Cohen's κ). If it's below 0.6, refine the rubric's definitions before using the results.
- **After a prompt or model change**, add 10 versions written since the change.

## What the numbers mean

- **Critical findings per lesson** with a 95% interval. With 30 lessons and no critical findings, the upper bound is about 10% (the rule of three). Say that rather than "no errors".
- The sample isn't random over learners: high-safety and reused lessons are over-represented on purpose. Report them separately from the even draw when estimating a rate.

## Outdated sources

Outdated-source detection is automatic: the daily freshness pass re-fetches sources and checks that their cited excerpts still hold. `outdatedSources` (`@sbi/evidence`) reports:

- the share of cited sources whose last check found them changed, gone or with new rights;
- the share overdue a check.

Reviewers still record `outdated-source` findings for things the automated pass can't see, such as a superseded study whose page is unchanged.
