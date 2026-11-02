import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import {
  MIN_ACCOUNT_AGE,
  UNDER_MIN_AGE,
  type ApiResponse,
  type FinishGoogleSignUpRequest,
  type ResetPasswordRequest,
  type SignInRequest,
  type SignUpRequest,
} from "@sbi/contracts";
import type { z } from "zod";
import type {
  AccountRepository,
  AccountTokenRepository,
  SessionRepository,
  StoredAccount,
  TokenPurpose,
} from "@sbi/db";
import { UserFacingException } from "../common/user-facing.exception";
import type { RateLimiter } from "../common/rate-limiter";
import type { ApiEnv } from "../env";
import {
  ACCOUNT_TOKENS,
  ACCOUNTS,
  API_ENV,
  AUTH_LIMITERS,
  GOOGLE_VERIFIER,
  MAILER,
  PASSWORD_PARAMS,
  SESSIONS,
} from "../tokens";
import { clearedSessionCookie, sessionCookie } from "./cookies";
import { InvalidGoogleCredentialError, type GoogleIdentity, type GoogleVerifier } from "./google";
import { linkEmail, type Mailer } from "./mailer";
import { hashPassword, verifyPassword, weakPasswordReason, type ScryptParams } from "./passwords";
import { hashSecret, newSecret } from "./secrets";

const HOUR_MS = 3_600_000;
const LINK_TTL_MS: Record<TokenPurpose, number> = {
  "reset-password": HOUR_MS,
  "verify-email": 24 * HOUR_MS,
};
const WRONG_CREDENTIALS = "Email or password is wrong.";
const TOO_MANY = "Too many attempts. Wait a few minutes and try again.";
const BAD_LINK = "This link has expired or was already used. Ask for a new one.";

export interface AuthLimiters {
  signInByIp: RateLimiter;
  signInByEmail: RateLimiter;
  signUpByIp: RateLimiter;
  emailByIp: RateLimiter;
  emailByAddress: RateLimiter;
}

export function toAccount(account: StoredAccount): ApiResponse<"getAccount"> {
  return {
    accountId: account.accountId,
    email: account.email,
    emailVerified: account.emailVerifiedAt !== null,
    firstName: account.firstName,
    lastName: account.lastName,
    linkedAt: account.linkedAt?.toISOString() ?? null,
  };
}

/** A signed-in result: the account to return and the Set-Cookie header that starts the session. */
export interface SignedIn {
  account: ApiResponse<"getAccount">;
  cookie: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private dummyHash: Promise<string> | undefined;

  constructor(
    @Inject(ACCOUNTS) private readonly accounts: AccountRepository,
    @Inject(SESSIONS) private readonly sessions: SessionRepository,
    @Inject(ACCOUNT_TOKENS) private readonly tokens: AccountTokenRepository,
    @Inject(MAILER) private readonly mail: Mailer,
    @Inject(GOOGLE_VERIFIER) private readonly google: GoogleVerifier | null,
    @Inject(PASSWORD_PARAMS) private readonly passwordParams: ScryptParams,
    @Inject(AUTH_LIMITERS) private readonly limits: AuthLimiters,
    @Inject(API_ENV)
    private readonly env: Pick<ApiEnv, "SESSION_TTL_DAYS" | "sessionCookieSecure" | "webOrigins">,
  ) {}

  async signUp(request: z.output<typeof SignUpRequest>, ip: string): Promise<SignedIn> {
    this.allow(this.limits.signUpByIp, ip);
    this.checkAge(request.age);
    this.checkPassword(request.password, request.email);
    const account = await this.accounts.create({
      ageAtSignup: request.age,
      createdAt: new Date(),
      email: request.email,
      emailVerifiedAt: null,
      firstName: request.firstName,
      googleSub: null,
      lastName: request.lastName,
      passwordHash: await hashPassword(request.password, this.passwordParams),
    });
    if (!account) {
      throw new UserFacingException(
        "An account already uses that email. Sign in instead.",
        HttpStatus.CONFLICT,
      );
    }
    await this.sendLink(account, "verify-email");
    return this.startSession(account);
  }

  async signIn({ email, password }: z.output<typeof SignInRequest>, ip: string): Promise<SignedIn> {
    this.allow(this.limits.signInByIp, ip);
    this.allow(this.limits.signInByEmail, email);
    const account = await this.accounts.findByEmail(email);
    // An unknown email still costs one hash, so timing does not reveal who has an account.
    const valid = account?.passwordHash
      ? await verifyPassword(password, account.passwordHash)
      : await verifyPassword(password, await this.dummy()).then(() => false);
    if (!account || !valid) {
      throw new UserFacingException(WRONG_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }
    return this.startSession(account);
  }

  async signOut(token: string | undefined): Promise<string> {
    if (token) await this.sessions.delete(hashSecret(token));
    return clearedSessionCookie(this.env.sessionCookieSecure);
  }

  /** The account behind a session cookie, or undefined when signed out. */
  async current(token: string | undefined): Promise<StoredAccount | undefined> {
    if (!token) return undefined;
    const accountId = await this.sessions.find(hashSecret(token), new Date());
    return accountId ? this.accounts.get(accountId) : undefined;
  }

  async googleSignIn(
    credential: string,
  ): Promise<{ signedIn: SignedIn } | { needs: ApiResponse<"googleSignIn"> }> {
    const identity = await this.verifyGoogle(credential);
    const known = await this.accountForGoogle(identity);
    if (known) return { signedIn: await this.startSession(known) };
    return {
      needs: {
        firstName: identity.givenName,
        lastName: identity.familyName,
        status: "needs-details",
      },
    };
  }

  async finishGoogleSignUp(request: z.output<typeof FinishGoogleSignUpRequest>): Promise<SignedIn> {
    const identity = await this.verifyGoogle(request.credential);
    this.checkAge(request.age);
    const known = await this.accountForGoogle(identity);
    if (known) return this.startSession(known);
    const account = await this.accounts.create({
      ageAtSignup: request.age,
      createdAt: new Date(),
      email: identity.email,
      emailVerifiedAt: new Date(),
      firstName: request.firstName,
      googleSub: identity.sub,
      lastName: request.lastName,
      passwordHash: null,
    });
    if (!account) {
      throw new UserFacingException(
        "An account already uses that email. Sign in instead.",
        HttpStatus.CONFLICT,
      );
    }
    return this.startSession(account);
  }

  async verifyEmail(token: string): Promise<void> {
    const accountId = await this.tokens.consume(hashSecret(token), "verify-email", new Date());
    if (!accountId) throw new UserFacingException(BAD_LINK, HttpStatus.BAD_REQUEST);
    await this.accounts.update(accountId, { emailVerifiedAt: new Date() });
  }

  async resendVerification(account: StoredAccount, ip: string): Promise<void> {
    this.allow(this.limits.emailByIp, ip);
    this.allow(this.limits.emailByAddress, account.email);
    if (!account.emailVerifiedAt) await this.sendLink(account, "verify-email");
  }

  /** Always succeeds, so the reply never says whether an email has an account. */
  async requestPasswordReset(email: string, ip: string): Promise<void> {
    this.allow(this.limits.emailByIp, ip);
    this.allow(this.limits.emailByAddress, email);
    const account = await this.accounts.findByEmail(email);
    if (account) await this.sendLink(account, "reset-password");
  }

  async resetPassword({ token, password }: z.output<typeof ResetPasswordRequest>): Promise<void> {
    const accountId = await this.tokens.consume(hashSecret(token), "reset-password", new Date());
    const account = accountId ? await this.accounts.get(accountId) : undefined;
    if (!account) throw new UserFacingException(BAD_LINK, HttpStatus.BAD_REQUEST);
    this.checkPassword(password, account.email);
    await this.accounts.update(account.accountId, {
      // Opening the emailed link proves the inbox too.
      emailVerifiedAt: account.emailVerifiedAt ?? new Date(),
      passwordHash: await hashPassword(password, this.passwordParams),
    });
    // Whoever knew the old password is signed out everywhere.
    await this.sessions.deleteForAccount(account.accountId);
  }

  private async accountForGoogle(identity: GoogleIdentity) {
    const bySub = await this.accounts.findByGoogleSub(identity.sub);
    if (bySub) return bySub;
    const byEmail = await this.accounts.findByEmail(identity.email);
    if (!byEmail) return undefined;
    // Google proves the inbox; an unverified password set by someone else must not survive that.
    const proven = byEmail.emailVerifiedAt !== null;
    await this.accounts.update(byEmail.accountId, {
      emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
      googleSub: identity.sub,
      passwordHash: proven ? byEmail.passwordHash : null,
    });
    if (!proven) await this.sessions.deleteForAccount(byEmail.accountId);
    return this.accounts.get(byEmail.accountId);
  }

  private async verifyGoogle(credential: string): Promise<GoogleIdentity> {
    if (!this.google) {
      throw new UserFacingException(
        "Google sign-in is not available here.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    let identity: GoogleIdentity;
    try {
      identity = await this.google(credential);
    } catch (error) {
      if (!(error instanceof InvalidGoogleCredentialError)) throw error;
      throw new UserFacingException(
        "Google sign-in did not work. Try again.",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!identity.emailVerified) {
      throw new UserFacingException(
        "Use a Google account with a verified email address.",
        HttpStatus.UNAUTHORIZED,
      );
    }
    return identity;
  }

  private async startSession(account: StoredAccount): Promise<SignedIn> {
    const { hash, token } = newSecret();
    const now = new Date();
    const ttlSeconds = this.env.SESSION_TTL_DAYS * 86_400;
    await this.sessions.create(
      hash,
      account.accountId,
      now,
      new Date(now.getTime() + ttlSeconds * 1000),
    );
    return {
      account: toAccount(account),
      cookie: sessionCookie(token, ttlSeconds, this.env.sessionCookieSecure),
    };
  }

  // A failed email must not undo the sign-up; the learner can ask for the link again.
  private async sendLink(account: StoredAccount, purpose: TokenPurpose) {
    const { hash, token } = newSecret();
    await this.tokens.issue(
      hash,
      account.accountId,
      purpose,
      new Date(Date.now() + LINK_TTL_MS[purpose]),
    );
    const web = this.env.webOrigins[0] ?? "";
    const to = { email: account.email, name: account.firstName };
    const email =
      purpose === "verify-email"
        ? linkEmail(
            to,
            "Confirm your email",
            "Please confirm this is your email address for Science Behind It.",
            "Confirm my email",
            `${web}/account/verify?token=${token}`,
            "The link works once, for 24 hours. If you did not make an account, ignore this email.",
          )
        : linkEmail(
            to,
            "Reset your password",
            "Someone asked to reset the password for your Science Behind It account.",
            "Choose a new password",
            `${web}/account/reset?token=${token}`,
            "The link works once, for 1 hour. If this was not you, ignore this email; your password stays the same.",
          );
    try {
      await this.mail(email);
    } catch (error) {
      this.logger.error(
        `Sending ${purpose} email failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private checkAge(age: number) {
    if (age < MIN_ACCOUNT_AGE) throw new UserFacingException(UNDER_MIN_AGE, HttpStatus.FORBIDDEN);
  }

  private checkPassword(password: string, email: string) {
    const weak = weakPasswordReason(password, email);
    if (weak) throw new UserFacingException(weak, HttpStatus.BAD_REQUEST);
  }

  private allow(limiter: RateLimiter, key: string) {
    if (!limiter.allow(key)) throw new UserFacingException(TOO_MANY, HttpStatus.TOO_MANY_REQUESTS);
  }

  private dummy() {
    this.dummyHash ??= hashPassword("not-a-real-password", this.passwordParams);
    return this.dummyHash;
  }
}
