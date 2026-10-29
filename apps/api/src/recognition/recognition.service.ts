import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { newId, type ApiRequest, type ApiResponse, type NextStep } from "@sbi/contracts";
import {
  detectImageType,
  ObjectMissingError,
  recognisedExpiry,
  type MediaRegistry,
  type ObjectStorage,
  type RetentionPolicy,
  type UploadPolicy,
} from "@sbi/media";
import {
  buildRecognitionResult,
  planClarification,
  rankCandidates,
  type Clarification,
  withSelection,
  type FallbackRecogniser,
  type RecognitionResultRepository,
  type Selection,
} from "@sbi/recognition";
import type { Taxonomy } from "@sbi/taxonomy";
import { UserFacingException } from "../common/user-facing.exception";
import type { ApiEnv } from "../env";
import { ObservationsService } from "../taxonomy/observations.service";
import {
  API_ENV,
  MEDIA_REGISTRY,
  OBJECT_STORAGE,
  RECOGNISER,
  RECOGNITION_RESULTS,
  RETENTION_POLICY,
  TAXONOMY,
  UPLOAD_POLICY,
} from "../tokens";

const GONE = "This photo's result has been deleted. Take the photo again.";
const UNAVAILABLE = "We could not recognise the photo right now. Describe the object instead.";

function toNextStep(plan: Clarification): NextStep {
  switch (plan.kind) {
    case "proceed":
      return { kind: "proceed", taxonomyId: plan.candidate.taxonomyId };
    case "ask":
      return {
        kind: "ask",
        question: plan.question,
        options: plan.options,
        fallback: plan.fallback,
      };
    default:
      return plan;
  }
}

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(
    @Inject(RECOGNISER) private readonly recogniser: FallbackRecogniser | null,
    @Inject(RECOGNITION_RESULTS) private readonly results: RecognitionResultRepository,
    @Inject(TAXONOMY) private readonly taxonomy: Taxonomy,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(MEDIA_REGISTRY) private readonly registry: Pick<MediaRegistry, "expireSooner">,
    @Inject(RETENTION_POLICY) private readonly retention: RetentionPolicy,
    @Inject(UPLOAD_POLICY) private readonly uploadPolicy: UploadPolicy,
    @Inject(API_ENV) private readonly env: Pick<ApiEnv, "ranking" | "recognitionRetention">,
    @Inject(ObservationsService) private readonly observations: ObservationsService,
  ) {}

  async recognise({
    key,
    sessionId = newId(),
  }: ApiRequest<"recognisePhoto">): Promise<ApiResponse<"recognisePhoto">> {
    if (!this.recogniser) {
      throw new UserFacingException(UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const image = await this.read(key);
    const mime = detectImageType(image);
    if (!mime) {
      throw new UserFacingException("Unknown photo.", HttpStatus.BAD_REQUEST);
    }
    let outcome;
    try {
      outcome = await this.recogniser.recognise({ bytes: image, mime });
    } catch (error) {
      this.logger.warn(`Recognition failed: ${error instanceof Error ? error.message : error}`);
      throw new UserFacingException(UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
    }
    const now = new Date();
    const ranked = rankCandidates(outcome, this.taxonomy, this.env.ranking);
    const result = await buildRecognitionResult({
      image,
      now,
      outcome,
      ranked,
      retention: this.env.recognitionRetention,
      sessionId,
    });
    await this.results.save(result);
    for (const label of ranked.unmapped) {
      await this.observations.recordGap(label, "recognition-label");
    }
    // Recognition was the photo's only purpose, so the original need not wait out its full TTL.
    await this.registry.expireSooner(key, recognisedExpiry(now, this.retention));
    return {
      resultId: result.resultId,
      sessionId,
      candidates: ranked.candidates.map(({ calibratedConfidence: _, ...candidate }) => ({
        ...candidate,
        parts: (this.taxonomy.get(candidate.taxonomyId)?.parts ?? []).map((part) => ({
          taxonomyId: part.id,
          label: part.label,
        })),
      })),
      next: toNextStep(planClarification(ranked, this.taxonomy, this.env.ranking)),
    };
  }

  async recordSelection({
    resultId,
    selection,
  }: ApiRequest<"recordSelection">): Promise<ApiResponse<"recordSelection">> {
    const result = await this.results.get(resultId);
    if (!result) {
      throw new UserFacingException(GONE, HttpStatus.NOT_FOUND);
    }
    let choice: Selection;
    if (selection.kind === "free-text") {
      choice = { correction: selection };
    } else if (result.candidates.some((c) => c.taxonomyId === selection.taxonomyId)) {
      choice = { taxonomyId: selection.taxonomyId };
    } else if (this.isKnown(selection.taxonomyId)) {
      choice = {
        taxonomyId: selection.taxonomyId,
        correction: { kind: "selected-alternative", taxonomyId: selection.taxonomyId },
      };
    } else {
      throw new UserFacingException("Unknown object.", HttpStatus.BAD_REQUEST);
    }
    if (!(await this.results.update(withSelection(result, choice)))) {
      throw new UserFacingException(GONE, HttpStatus.NOT_FOUND);
    }
    return { recorded: true };
  }

  // Part ids extend their object's id ("object.bicycle:chain"), so a part is checked on its parent.
  private isKnown(taxonomyId: string) {
    const [objectId = ""] = taxonomyId.split(":");
    const entry = this.taxonomy.get(objectId);
    return objectId === taxonomyId
      ? entry !== undefined
      : (entry?.parts.some((part) => part.id === taxonomyId) ?? false);
  }

  private async read(key: string) {
    try {
      return await this.storage.read(key, this.uploadPolicy.maxBytes);
    } catch (error) {
      if (error instanceof ObjectMissingError) {
        throw new UserFacingException(
          "This photo has already been deleted. Take it again.",
          HttpStatus.NOT_FOUND,
        );
      }
      this.logger.error(
        `Reading a photo failed: ${error instanceof Error ? error.message : error}`,
      );
      throw new UserFacingException(UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
