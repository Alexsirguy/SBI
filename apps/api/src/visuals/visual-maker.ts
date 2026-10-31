import { Logger } from "@nestjs/common";
import { lessonContentHash, type Lesson, VisualRef, visualManifestUri } from "@sbi/contracts";
import type { LlmProvider } from "@sbi/llm";
import type { LessonRepository, RightsGate } from "@sbi/orchestrator";
import type { VisualAssetRepository } from "@sbi/rights";
import type { VisualManifestRepository } from "@sbi/visuals";
import { generateVisual, type PubChemCache } from "@sbi/visuals/server";

/** Gives a published lesson its visual, or leaves it without one; it never holds the lesson. */
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
  return async (lesson) => {
    // A reused lesson keeps the visual it was given the first time (#220: cached per lesson).
    if (!deps.provider || lesson.visuals.length > 0) return lesson.visuals;
    try {
      const result = await generateVisual({
        provider: deps.provider,
        lesson: {
          lessonId: lesson.lessonId,
          title: lesson.title,
          summary: lesson.summary,
          readingLevel: lesson.readingLevel,
          claims: lesson.claims.map(({ claimId, text }) => ({ claimId, text })),
        },
        pubchem: { cache: deps.pubchem },
        signal: AbortSignal.timeout(deps.timeoutMs ?? 150_000),
      });
      if (!result) {
        logger.log(`No visual for lesson ${lesson.lessonId}: the model chose none`);
        return [];
      }
      if ("problems" in result) {
        // Problems name fields and parts of the spec, never the learner's words.
        logger.warn(
          `No visual for lesson ${lesson.lessonId}: ${result.problems.join(" | ").slice(0, 1500)}`,
        );
        return [];
      }
      const { manifest } = result;
      for (const asset of result.assets) await deps.assets.save(asset);
      await deps.manifests.save(manifest);
      const ref = VisualRef.parse({
        visualId: manifest.visualId,
        kind: manifest.kind,
        manifestUri: visualManifestUri(manifest.visualId),
        alt: manifest.alt,
      });
      const withVisual: Lesson = { ...lesson, visuals: [ref] };
      withVisual.reuse = { ...lesson.reuse, contentHash: await lessonContentHash(withVisual) };
      const decision = await deps.rights.check(withVisual);
      if (!decision.cleared) {
        logger.warn(
          `Visual for lesson ${lesson.lessonId} not cleared: ${decision.reason ?? "no reason"}`,
        );
        return [];
      }
      await deps.lessons.save(withVisual);
      logger.log(
        `Visual ${manifest.kind} for lesson ${lesson.lessonId} after ${result.attempts} attempt(s)`,
      );
      return [ref];
    } catch (error) {
      logger.warn(
        `No visual for lesson ${lesson.lessonId}: ${String((error as Error)?.message ?? error)}`,
      );
      return [];
    }
  };
}
