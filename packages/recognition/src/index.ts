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
