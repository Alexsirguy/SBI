import {
  createParamDecorator,
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { StoredAccount } from "@sbi/db";
import { UserFacingException } from "../common/user-facing.exception";
import type { ApiEnv } from "../env";
import { API_ENV } from "../tokens";
import { AuthService } from "./auth.service";
import { readCookie, SESSION_COOKIE } from "./cookies";

export interface SessionRequest {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  account?: StoredAccount;
}

const header = (request: SessionRequest, name: string) => {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
};

export const sessionToken = (request: SessionRequest) =>
  readCookie(header(request, "cookie"), SESSION_COOKIE);

/** A cookie-carrying POST must come from our web app, so another site cannot act as the learner. */
@Injectable()
export class SameOriginGuard implements CanActivate {
  constructor(@Inject(API_ENV) private readonly env: Pick<ApiEnv, "webOrigins">) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const origin = header(request, "origin");
    // Browsers always send Origin on POST; tools without one cannot carry a victim's cookie.
    if (request.method === "POST" && origin && !this.env.webOrigins.includes(origin)) {
      throw new UserFacingException("This request came from another site.", HttpStatus.FORBIDDEN);
    }
    return true;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const account = await this.auth.current(sessionToken(request));
    if (!account) {
      throw new UserFacingException("Sign in to use your account.", HttpStatus.UNAUTHORIZED);
    }
    request.account = account;
    return true;
  }
}

export const SignedInAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): StoredAccount => {
    const account = context.switchToHttp().getRequest<SessionRequest>().account;
    if (!account) {
      throw new UserFacingException("Sign in to use your account.", HttpStatus.UNAUTHORIZED);
    }
    return account;
  },
);
