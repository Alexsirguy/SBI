import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule, configureApp } from "./app.module";
import type { ApiEnv } from "./env";
import { API_ENV } from "./tokens";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  const env = app.get<ApiEnv>(API_ENV);
  configureApp(app, env.webOrigins).enableShutdownHooks();
  await app.listen({ host: "0.0.0.0", port: env.PORT });
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
