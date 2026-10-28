import { Global, Module } from "@nestjs/common";
import { loadEnv } from "../env";
import { API_ENV } from "../tokens";

@Global()
@Module({
  providers: [{ provide: API_ENV, useFactory: () => loadEnv() }],
  exports: [API_ENV],
})
export class ConfigModule {}
