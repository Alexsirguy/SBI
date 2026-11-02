import { webEnv } from "../env";
import { createApiClient } from "./api-client";

export const api = createApiClient(webEnv.apiUrl);
