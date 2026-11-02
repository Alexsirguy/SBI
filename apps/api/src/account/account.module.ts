import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import type { ApiEnv } from "../env";
import { ACCOUNTS, API_ENV, REPOSITORIES, TOKEN_VERIFIER } from "../tokens";
import { AccountController } from "./account.controller";
import { AccountGuard } from "./account.guard";
import { createTokenVerifier } from "./token-verifier";

@Module({
  controllers: [AccountController],
  providers: [
    AccountGuard,
    {
      provide: TOKEN_VERIFIER,
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => (env.auth ? createTokenVerifier(env.auth) : null),
    },
    {
      provide: ACCOUNTS,
      inject: [REPOSITORIES],
      useFactory: (repos: Repositories) => repos.accounts,
    },
  ],
})
export class AccountModule {}
