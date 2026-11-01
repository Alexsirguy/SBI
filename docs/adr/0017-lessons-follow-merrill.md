# 0017. Lessons follow Merrill's First Principles

- Status: accepted
- Date: 2026-10-31
- Issue: #312
- Supersedes: the fixed 8-module shape of 0011; 0011's model-knowledge rules stand
- Amends: 0014 (visuals follow the lesson's experiment) and 0016 (no early answer)

## Context

From lesson-draft v6 (ADR 0011), every lesson had the same eight modules: what-youre-seeing, short-answer, first-principles, how-parts-work, try-an-idea, history, check-thinking and go-further. They read as an explanation. The learner was told the answer first and asked to do something only near the end. The interactive visual (ADR 0014) had sliders, but nothing in the lesson asked the learner to use them.

[Merrill's First Principles of Instruction](https://en.wikipedia.org/wiki/First_Principles_of_Instruction) say people learn best when they work on a real problem, recall what they already know, watch the solution demonstrated, apply it to new cases themselves, and then carry it into their own lives.

## Decision

**Shape.** From lesson-draft v7, a lesson has five sections, always in this order, and no others:

- **problem:** names the object and poses one real task with it, in the second person ("Your guitar's A string sounds flat. What do you change?").
- **activate:** ties the problem to an everyday experience the learner already has, plus one guess task.
- **demonstrate:** the worked solution to the opening problem, as numbered cause-and-effect `steps`. A step may set experiment controls so the learner watches the effect.
- **apply:** 2 or 3 challenges on a new case with the same principle. Each asks for a prediction, then asks the learner to set the sliders so a readout meets a goal. Each option's feedback coaches toward the principle and names the misconception behind it. The draft names the new case in `newCase` before writing any section, and that scene becomes apply's text, so the challenges and their introduction always describe the same thing.
- **integrate:** one thing to notice or try in everyday life this week, and a reflection question. On high-risk topics it is an observation or thought experiment only.

`Lesson.tasks` holds exactly one activate guess and 2 or 3 apply challenges. `Lesson.experiment` holds 1 to 4 controls and 1 to 3 readouts with real quantities, units and ranges. Every control and readout a step or task names must exist in the experiment.

**History is dropped.** Model knowledge is no longer asked how the object was invented. Evidence gaps are only the research questions no teachable claim answers, plus the learner's question when nothing was found.

**Citations.** problem, activate and integrate may be uncited, as check-thinking was. demonstrate must cite. apply's text is only the scene of its new case, so it cites nothing and is not judged; its challenges cite, and the entailment judge reads their prompts and feedback against those claims. The judge also reads demonstrate's steps with their section. The reading-level check covers steps, task prompts and feedback. A section rewrite keeps its steps and never rewrites apply's scene; when apply is rejected, its challenges' feedback is rewritten against their claims instead. After a rewrite, only the rewritten sections are judged again, since every claim and so the contradiction verdict are unchanged. The judge sees claims from the AI's own knowledge as general knowledge, which the lesson teaches plainly (ADR 0011), and when the learner's question is the only open one, model knowledge may give up to 12 claims covering the mechanism, how its quantities relate and the common misconceptions, so the challenges have something to stand on.

**No answer before the guess.** The early quick answer of ADR 0016 streamed the answer before the lesson. That gave away the activate guess, so it is gone. The `quick-answer` event now arrives just before the lesson, with the summary as its short answer.

**The experiment is a contract with the visual.**

- The visual prompt (v7) gets the lesson's experiment.
- Every kind with sliders (all but molecule, process and none) must have a control with each experiment control's id, and a readout with each experiment readout's id. The visual writes its own mathjs formula for each readout.
- Matching controls take the experiment's min, max and starting value.
- A missing id is a problem sent back in the one repair attempt (ADR 0014). If ids are still missing after the repair, the visual is kept. The web falls back to multiple choice for tasks it cannot set up.

**Reuse.** Cached lessons and fallbacks are served only when they were drafted with the current draft prompt, so 8-module lessons stop being served.

**A stage diagram beside the experiment.** The experiment visual needs sliders, so a process diagram can never be a Merrill lesson's only visual. Some ideas, though, are a sequence of stages the learner should first see as a whole: photosynthesis, the water cycle, a fridge's loop.

- Alongside the experiment visual, and at the same time, the generator is asked for a diagram (prompt `visual-diagram`). It may answer only `process` or `none`.
- It answers `none` unless the mechanism has at least three different stages, in order.
- The diagram follows the demonstration's steps. It sits after the experiment in the lesson's visuals, and the experiment controller always drives the first visual that is not a diagram.
- If the experiment visual fails, as the leaf's playground did, the diagram still gives the lesson a correct picture.
- On the seed set, 4 of 16 lessons got one.

## Consequences

- Lessons ask the learner to think and act before they explain. The visual becomes the place where the learner applies the idea.
- Every lesson in the cache becomes a miss once, and is drafted again in the new shape. Older lessons stay readable by id, and the contract still accepts both shapes.
- The draft carries more structure: tasks, steps and an experiment. Small slips, such as a setting for an unknown control or a goal on an unknown readout, are dropped rather than failing the draft. A wrong count of tasks still fails it.
- Without the early answer, the learner sees progress and then the whole lesson, never the answer alone. Repeat questions that reuse a pack lose the answer they used to see at 5 to 10 s.
- A visual that misses the experiment's ids leaves its challenges as multiple choice. How often this happens is logged per lesson.
