import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

export interface SignedInIdentity {
  issuer: string;
  subject: string;
}

export type TokenVerifier = (token: string) => Promise<SignedInIdentity>;

export class InvalidTokenError extends Error {}

const Discovery = z.object({ jwks_uri: z.url() });

// Discovery keeps us provider-neutral; a failed lookup is retried on the next request.
function discoveredKeys(issuer: string): JWTVerifyGetKey {
  let keys: Promise<JWTVerifyGetKey> | undefined;
  const discover = async () => {
    const response = await fetch(new URL(".well-known/openid-configuration", withSlash(issuer)));
    if (!response.ok) throw new Error(`OIDC discovery failed: ${response.status}.`);
    const { jwks_uri } = Discovery.parse(await response.json());
    return createRemoteJWKSet(new URL(jwks_uri));
  };
  return async (header, token) => {
    keys ??= discover().catch((error: unknown) => {
      keys = undefined;
      throw error;
    });
    return (await keys)(header, token);
  };
}

function withSlash(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

/** Checks a bearer access token's signature, issuer, audience and expiry. */
export function createTokenVerifier(
  { issuer, audience }: { issuer: string; audience: string },
  keys: JWTVerifyGetKey = discoveredKeys(issuer),
): TokenVerifier {
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ["RS256", "ES256"],
        audience,
        issuer: [issuer, withSlash(issuer)],
      });
      if (!payload.sub || !payload.iss) throw new InvalidTokenError("Token has no subject.");
      return { issuer: payload.iss, subject: payload.sub };
    } catch (error) {
      if (error instanceof InvalidTokenError) throw error;
      throw new InvalidTokenError(error instanceof Error ? error.message : String(error));
    }
  };
}
