# 0027. Classrooms without learner data

- Status: accepted
- Date: 2026-11-08
- Issue: #112

## Context

Epic #111 adds teachers and classes. Its phase gate asked for validated teacher demand and a finished privacy design first. On 2026-11-08 the owner chose to build first and run the teacher interviews afterwards (`docs/research/educators/`). Classes are often 8–12-year-olds, and ADR 0020 stores nothing about anyone under 13. The first two curricula are the US (NGSS and Common Core) and Nigeria (NERDC), so COPPA, FERPA and Nigeria's NDPA all apply.

## Decision

- **Only teachers have accounts.** Teaching tools are an opt-in for people 18 or over. It can be chosen at sign-up ("I teach or tutor") or later on `/teach`, and needs a confirmed email either way. A Google sign-up counts as confirmed (2026-11-08 update).
- **Pupils join by code, with no account and no stored data.** A class has a random join code, stored only as a hash. The code rides with a pupil's lesson and tutor requests for the visit. Rotating it revokes the old link.
- **Controls are enforced on the server:** age band lock, blocked risk categories and tutor off. They can only make the app stricter.
- **The class summary is counts only.** Weekly counts per class, no pupil or visit id, any count under 5 hidden, with complementary suppression. No per-pupil view will be added under this ADR.
- **Curriculum is shown, not tracked.** Each class picks a curriculum and level; pupils can also choose one on their own device. Nothing about the choice is stored on the server.

## Consequences

- Classes work for any age without parental consent flows, and add no child personal data to the retention table.
- Teachers can't see which pupil struggled or set individual work. If interviews show teachers need that, it needs a new ADR, a legal basis for children's data, and probably school contracts.
- A leaked join code lets anyone see the class's lesson list until it is rotated. The list holds no personal data.
- Class names are free text a teacher could fill with a pupil's name. The form warns against it; counsel may ask for more (`privacy-legal-design.md`).
- The demand question is still open; this ADR should be revisited when the teacher synthesis is done.
