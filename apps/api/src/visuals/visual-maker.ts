import { Logger } from "@nestjs/common";
import { lessonContentHash, type Lesson, VisualRef, visualManifestUri } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import type { LessonRepository, RightsGate } from "@sbi/orchestrator";
import type { VisualAssetRepository } from "@sbi/rights";
import type { VisualManifestRepository } from "@sbi/visuals";
import { generateVisual, type PubChemCache } from "@sbi/visuals/server";

/** Gives a published lesson its experiment visual and, for staged topics, a diagram; never holds it. */
export type VisualMaker = (lesson: Lesson) => Promise<Lesson["visuals"]>;

const logger = new Logger("VisualMaker");

export function createVisualMaker(deps: {
  provider: LlmProvider | null;
  manifests: Pick<VisualManifestRepository, "save">;
  assets: Pick<VisualAssetRepository, "save">;
  lessons: Pick<LessonRepository, "save">;
  rights: RightsGate;
  pubchem: PubChemCache;
  /** Two attempts at the model's own timeout, so a stuck call cannot keep the stream open. */
  timeoutMs?: number;
}): VisualMaker {
  // One mode's picture, or undefined; each failure is logged and never holds the lesson.
  async function make(lesson: Lesson, mode: "experiment" | "diagram") {
    if (!deps.provider) return undefined;
    const what = mode === "diagram" ? "diagram" : "visual";
    try {
      const result = await generateVisual({
        provider: deps.provider,
        lesson: {
          lessonId: lesson.lessonId,
          title: lesson.title,
          summary: lesson.summary,
          readingLevel: lesson.readingLevel,
          claims: lesson.claims.map(({ claimId, text }) => ({ claimId, text })),
          steps: lesson.sections.flatMap((section) => section.steps ?? []).map((step) => step.text),
          experiment: lesson.experiment,
        },
        pubchem: { cache: deps.pubchem },
        signal: AbortSignal.timeout(deps.timeoutMs ?? 150_000),
        mode,
      });
      if (!result) {
        logger.log(`No ${what} for lesson ${lesson.lessonId}: the model chose none`);
        return undefined;
      }
      if ("problems" in result) {
        // Problems name fields and parts of the spec, never the learner's words.
        logger.warn(
          `No ${what} for lesson ${lesson.lessonId}: ${result.problems.join(" | ").slice(0, 1500)}`,
        );
        return undefined;
      }
      if (result.missing.length > 0) {
        // Kept anyway: tasks whose ids the visual lacks fall back to their options (ADR 0017).
        logger.warn(
          `Visual for lesson ${lesson.lessonId} misses experiment ids: ${result.missing.join(" | ").slice(0, 1500)}`,
        );
      }
      return result;
    } catch (error) {
      logger.warn(
        `No ${what} for lesson ${lesson.lessonId}: ${String((error as Error)?.message ?? error)}`,
      );
      return undefined;
    }
  }

  return async (lesson) => {
    // A reused lesson keeps the visuals it was given the first time (#220: cached per lesson).
    if (!deps.provider || lesson.visuals.length > 0) return lesson.visuals;
    // Made side by side, so the diagram adds no wait; the experiment comes first, as the one to drive.
    const made = (await Promise.all([make(lesson, "experiment"), make(lesson, "diagram")])).filter(
      (result) => result !== undefined,
    );
    if (made.length === 0) return [];
    try {
      for (const { assets, manifest } of made) {
        for (const asset of assets) await deps.assets.save(asset);
        await deps.manifests.save(manifest);
      }
      const refs = made.map(({ manifest }) =>
        VisualRef.parse({
          visualId: manifest.visualId,
          kind: manifest.kind,
          manifestUri: visualManifestUri(manifest.visualId),
          alt: manifest.alt,
        }),
      );
      const withVisual: Lesson = { ...lesson, visuals: refs };
      withVisual.reuse = { ...lesson.reuse, contentHash: await lessonContentHash(withVisual) };
      const decision = await deps.rights.check(withVisual);
      if (!decision.cleared) {
        logger.warn(
          `Visual for lesson ${lesson.lessonId} not cleared: ${decision.reason ?? "no reason"}`,
        );
        return [];
      }
      await deps.lessons.save(withVisual);
      for (const { manifest, attempts } of made) {
        logger.log(
          `Visual ${manifest.kind} for lesson ${lesson.lessonId} after ${attempts} attempt(s)`,
        );
      }
      return refs;
    } catch (error) {
      logger.warn(
        `No visual for lesson ${lesson.lessonId}: ${String((error as Error)?.message ?? error)}`,
      );
      return [];
    }
  };
}
