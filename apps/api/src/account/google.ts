import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  givenName: string;
  familyName: string;
}

export type GoogleVerifier = (credential: string) => Promise<GoogleIdentity>;

export class InvalidGoogleCredentialError extends Error {}

const GOOGLE_KEYS = "https://www.googleapis.com/oauth2/v3/certs";

/** Checks an ID token from Google's sign-in button: signature, issuer, audience and expiry. */
export function createGoogleVerifier(
  clientId: string,
  keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(GOOGLE_KEYS)),
): GoogleVerifier {
  return async (credential) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(credential, keys, {
        algorithms: ["RS256"],
        audience: clientId,
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      }));
    } catch (error) {
      throw new InvalidGoogleCredentialError(
        error instanceof Error ? error.message : String(error),
      );
    }
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    if (!payload.sub || !text(payload.email)) {
      throw new InvalidGoogleCredentialError("Google did not share an email address.");
    }
    return {
      email: text(payload.email).toLowerCase(),
      emailVerified: payload.email_verified === true,
      familyName: text(payload.family_name),
      givenName: text(payload.given_name),
      sub: payload.sub,
    };
  };
}
