import type { Auth0Client } from "@auth0/auth0-spa-js";

export interface AuthConfig {
  audience: string;
  clientId: string;
  domain: string;
}

/** What the app needs from the sign-in provider; tests pass a fake. */
export interface AccountSession {
  signedIn(): Promise<boolean>;
  signIn(returnTo: string): Promise<void>;
  /** Completes the provider redirect and says where the learner was going. */
  finishSignIn(): Promise<string>;
  token(): Promise<string | undefined>;
  signOut(): Promise<void>;
}

const CALLBACK = "/account/callback";

// Only a path on this site is followed back, so a crafted link cannot redirect elsewhere.
export function safeReturnTo(value: unknown): string {
  return typeof value === "string" && /^\/(?!\/)/.test(value) ? value : "/account";
}

export function createAuth0Session(config: AuthConfig): AccountSession {
  let client: Promise<Auth0Client> | undefined;
  // Loaded on demand, so learners who never sign in never download the provider's code.
  const load = () =>
    (client ??= import("@auth0/auth0-spa-js").then(
      ({ Auth0Client }) =>
        new Auth0Client({
          authorizationParams: {
            audience: config.audience,
            redirect_uri: `${window.location.origin}${CALLBACK}`,
          },
          // Refresh tokens in storage keep sign-in across reloads without third-party cookies.
          cacheLocation: "localstorage",
          clientId: config.clientId,
          domain: config.domain,
          useRefreshTokens: true,
        }),
    ));

  return {
    async finishSignIn() {
      const { appState } = await (await load()).handleRedirectCallback<{ returnTo?: string }>();
      return safeReturnTo(appState?.returnTo);
    },
    async signIn(returnTo) {
      await (await load()).loginWithRedirect({ appState: { returnTo: safeReturnTo(returnTo) } });
    },
    async signOut() {
      await (
        await load()
      ).logout({ logoutParams: { returnTo: `${window.location.origin}/account` } });
    },
    async signedIn() {
      return (await load()).isAuthenticated();
    },
    async token() {
      const auth0 = await load();
      return (await auth0.isAuthenticated()) ? auth0.getTokenSilently() : undefined;
    },
  };
}
