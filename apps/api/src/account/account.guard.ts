import {
  createParamDecorator,
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { UserFacingException } from "../common/user-facing.exception";
import { TOKEN_VERIFIER } from "../tokens";
import type { SignedInIdentity, TokenVerifier } from "./token-verifier";

interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  identity?: SignedInIdentity;
}

const SIGN_IN = "Sign in again to use your account.";

/** Admits a request only with a valid bearer token; accounts are off when no provider is set. */
@Injectable()
export class AccountGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verify: TokenVerifier | null) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.verify) {
      throw new UserFacingException(
        "Accounts are not available here.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    const token = typeof header === "string" ? /^Bearer (\S+)$/i.exec(header)?.[1] : undefined;
    if (!token) throw new UserFacingException(SIGN_IN, HttpStatus.UNAUTHORIZED);
    try {
      request.identity = await this.verify(token);
    } catch {
      throw new UserFacingException(SIGN_IN, HttpStatus.UNAUTHORIZED);
    }
    return true;
  }
}

export const SignedIn = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SignedInIdentity => {
    const identity = context.switchToHttp().getRequest<AuthedRequest>().identity;
    if (!identity) throw new UserFacingException(SIGN_IN, HttpStatus.UNAUTHORIZED);
    return identity;
  },
);
