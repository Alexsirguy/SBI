import { webEnv } from "../../env";
import { createAuth0Session, type AccountSession } from "./session";

/** Null when no provider is configured, which hides every account feature. */
export const accountSession: AccountSession | null = webEnv.auth
  ? createAuth0Session(webEnv.auth)
  : null;
