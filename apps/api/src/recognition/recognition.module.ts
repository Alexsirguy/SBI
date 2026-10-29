import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { createRecognitionProvider } from "@sbi/recognition";
import type { ApiEnv } from "../env";
import { MediaModule } from "../media/media.module";
import { TaxonomyModule } from "../taxonomy/taxonomy.module";
import { API_ENV, RECOGNISER, RECOGNITION_RESULTS, REPOSITORIES } from "../tokens";
import { RecognitionController } from "./recognition.controller";
import { RecognitionService } from "./recognition.service";

// Without the flag or a provider key the API still serves uploads and search; recognition answers 503.
export function recogniserFor(env: Pick<ApiEnv, "features" | "recognitionSource">) {
  const { META_MODEL_API_KEY, OPENAI_API_KEY } = env.recognitionSource;
  return env.features.photoRecognition && (META_MODEL_API_KEY || OPENAI_API_KEY)
    ? createRecognitionProvider(env.recognitionSource)
    : null;
}

@Module({
  imports: [MediaModule, TaxonomyModule],
  controllers: [RecognitionController],
  providers: [
    RecognitionService,
    {
      provide: RECOGNISER,
      inject: [API_ENV],
      useFactory: recogniserFor,
    },
    {
      provide: RECOGNITION_RESULTS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.recognitionResults,
    },
  ],
})
export class RecognitionModule {}
