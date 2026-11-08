import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from "@nestjs/common";
import {
  API_ROUTES,
  LessonPackRequest,
  PACK_FORMAT,
  PACK_VERSION,
  type ApiResponse,
  type LessonPack,
  type ServedVisual,
} from "@sbi/contracts";
import type { EvidenceRepositories } from "@sbi/evidence";
import type { LessonRepository, RightsGate } from "@sbi/orchestrator";
import { creditFor, type VisualAssetRepository } from "@sbi/rights";
import type { VisualManifestRepository } from "@sbi/visuals";
import type { z } from "zod";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import {
  LESSON_EVIDENCE,
  LESSON_RIGHTS,
  LESSONS,
  VISUAL_ASSETS,
  VISUAL_INTEGRITY,
  VISUAL_MANIFESTS,
} from "../tokens";
import type { SpecIntegrity } from "../visuals/integrity";
import { lessonSources } from "./sources";

type Withheld = LessonPack["withheld"][number];

/** Packs a lesson for offline use; each visual passes the rights register first, or stays out (#116). */
@Controller()
export class PackController {
  constructor(
    @Inject(LESSONS) private readonly lessons: Pick<LessonRepository, "get">,
    @Inject(LESSON_EVIDENCE) private readonly evidence: Pick<EvidenceRepositories, "sources">,
    @Inject(LESSON_RIGHTS) private readonly rights: RightsGate,
    @Inject(VISUAL_MANIFESTS) private readonly manifests: Pick<VisualManifestRepository, "get">,
    @Inject(VISUAL_INTEGRITY) private readonly intact: SpecIntegrity,
    @Inject(VISUAL_ASSETS) private readonly assets: Pick<VisualAssetRepository, "get">,
  ) {}

  @Post(API_ROUTES.exportLessonPack.path)
  @HttpCode(200)
  async pack(
    @Body(new ZodPipe(LessonPackRequest, "Say which lesson to save for offline use."))
    { lessonId, version }: z.output<typeof LessonPackRequest>,
  ): Promise<ApiResponse<"exportLessonPack">> {
    const stored = await this.lessons.get(lessonId, version);
    if (!stored) {
      throw new UserFacingException("That lesson could not be found.", HttpStatus.NOT_FOUND);
    }
    // Assumptions are the asker's own words, so a file that can be passed around never holds them.
    const lesson = { ...stored, assumptions: [] };
    const visuals: ServedVisual[] = [];
    const withheld: Withheld[] = [];
    for (const ref of lesson.visuals) {
      const manifest = await this.manifests.get(ref.visualId);
      const fallback = (reason: Withheld["reason"]) =>
        withheld.push({
          alt: ref.alt,
          kind: ref.kind,
          reason,
          text: manifest?.fallback.text ?? ref.alt,
          visualId: ref.visualId,
        });
      if (!manifest || !(await this.intact(manifest))) {
        fallback("unavailable");
        continue;
      }
      // Checked one visual at a time, so one uncleared asset costs only its own visual.
      const decision = await this.rights.check({ ...lesson, visuals: [ref] });
      if (!decision.cleared) {
        fallback("rights");
        continue;
      }
      // Playground code runs in a frame served by the API, which a saved file can't reach.
      if (manifest.kind === "playground") {
        fallback("needs-connection");
        continue;
      }
      const records = await Promise.all(manifest.assetIds.map((id) => this.assets.get(id)));
      const credits = records.flatMap((asset) => {
        const credit = asset && creditFor(asset);
        return credit ? [credit] : [];
      });
      visuals.push({ ...manifest, credits });
    }
    const sourceIds = [...new Set(lesson.claims.flatMap((claim) => claim.sourceIds))];
    return {
      exportedAt: new Date().toISOString(),
      format: PACK_FORMAT,
      lesson,
      packVersion: PACK_VERSION,
      // Excerpts follow each source's licence exactly as on screen: quoted, or a link only.
      sources: lessonSources(
        lesson,
        sourceIds.length > 0 ? await this.evidence.sources.getMany(sourceIds) : [],
      ),
      visuals,
      withheld,
    };
  }
}
