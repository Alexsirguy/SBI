import { webEnv } from "../env";
import { accountSession } from "./account/account-session";
import { createApiClient } from "./api-client";

export const api = createApiClient(webEnv.apiUrl, fetch, async () => accountSession?.token());
