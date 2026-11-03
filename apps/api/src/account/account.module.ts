import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { createRateLimiter } from "../common/rate-limiter";
import type { ApiEnv } from "../env";
import {
  ACCOUNT_TOKENS,
  ACCOUNTS,
  API_ENV,
  AUTH_LIMITERS,
  GOOGLE_VERIFIER,
  MAILER,
  PASSWORD_PARAMS,
  REPOSITORIES,
  SESSIONS,
} from "../tokens";
import { AccountController } from "./account.controller";
import { SameOriginGuard, SessionGuard } from "./account.guard";
import { AuthController } from "./auth.controller";
import { AuthService, type AuthLimiters } from "./auth.service";
import { createGoogleVerifier } from "./google";
import { createLogMailer, createZeptoMailer } from "./mailer";
import { DEFAULT_SCRYPT } from "./passwords";

const MINUTE_MS = 60_000;

@Module({
  controllers: [AuthController, AccountController],
  providers: [
    AuthService,
    SameOriginGuard,
    SessionGuard,
    { provide: ACCOUNTS, inject: [REPOSITORIES], useFactory: (r: Repositories) => r.accounts },
    { provide: SESSIONS, inject: [REPOSITORIES], useFactory: (r: Repositories) => r.sessions },
    {
      provide: ACCOUNT_TOKENS,
      inject: [REPOSITORIES],
      useFactory: (r: Repositories) => r.accountTokens,
    },
    {
      provide: MAILER,
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => (env.mail ? createZeptoMailer(env.mail) : createLogMailer()),
    },
    {
      provide: GOOGLE_VERIFIER,
      inject: [API_ENV],
      useFactory: (env: ApiEnv) =>
        env.GOOGLE_CLIENT_ID ? createGoogleVerifier(env.GOOGLE_CLIENT_ID) : null,
    },
    { provide: PASSWORD_PARAMS, useValue: DEFAULT_SCRYPT },
    {
      provide: AUTH_LIMITERS,
      // Guessing is slowed per address and per client; emails are capped so we cannot be used to spam.
      useFactory: (): AuthLimiters => ({
        emailByAddress: createRateLimiter({ limit: 3, windowMs: 60 * MINUTE_MS }),
        emailByIp: createRateLimiter({ limit: 10, windowMs: 60 * MINUTE_MS }),
        signInByEmail: createRateLimiter({ limit: 10, windowMs: 15 * MINUTE_MS }),
        signInByIp: createRateLimiter({ limit: 30, windowMs: 15 * MINUTE_MS }),
        signUpByIp: createRateLimiter({ limit: 10, windowMs: 60 * MINUTE_MS }),
      }),
    },
  ],
  // Other modules guard their account routes with the same session check.
  exports: [AuthService, SameOriginGuard, SessionGuard],
})
export class AccountModule {}
