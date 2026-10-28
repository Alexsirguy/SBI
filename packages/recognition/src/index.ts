export {
  answerClarification,
  NOT_SURE,
  planClarification,
  type CategoryFallback,
  type Clarification,
  type ClarificationAnswer,
  type ClarifyTaxonomy,
} from "./clarify";
export {
  createFallbackRecogniser,
  RecognitionUnavailableError,
  type FallbackOutcome,
  type FallbackRecogniser,
} from "./fallback";
export {
  assertNoTrainingReuse,
  createRecognitionProvider,
  RECOGNITION_PROVIDERS,
  type RecognitionProviderConfig,
} from "./providers";
export {
  DEFAULT_RANKING_CONFIG,
  gateLesson,
  parseRankingConfig,
  rankCandidates,
  UNCALIBRATED,
  type Calibration,
  type LabelResolver,
  type LessonGate,
  type RankedRecognition,
  type RankingConfig,
} from "./ranking";
export type { RecognitionResultRepository } from "./recognition-result-repository";
export {
  createVisionLlmRecogniser,
  RawCandidate,
  RECOGNITION_PROMPT_VERSION,
  RecognitionOutput,
  type RecogniseOptions,
  type RecognitionImage,
  type RecognitionOutcome,
  type RecognitionProvider,
} from "./vision-llm-recogniser";
