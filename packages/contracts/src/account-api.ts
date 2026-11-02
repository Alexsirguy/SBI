import { z } from "zod";
import { IsoDateTime, Uuid } from "./common";
import { ConsentRecord } from "./consent";
import { PhotoKey } from "./media-api";

/** GETs take their request as query parameters; this one needs none beyond the bearer token. */
export const AccountRequest = z.object({});

/** Only an opaque id is kept; the provider holds the email and name, never us. */
export const Account = z.object({
  accountId: Uuid,
  createdAt: IsoDateTime,
  linkedAt: IsoDateTime.nullable(),
});

/** Linking needs the account opt-in under current wording; photos travel by their private keys. */
export const LinkAccountRequest = z.object({
  consent: ConsentRecord,
  photoKeys: z.array(PhotoKey).max(200),
});

export const LinkedAccount = z.object({ accountId: Uuid, linkedPhotos: z.number().int().min(0) });

export const UnlinkAccountRequest = z.object({});

export const UnlinkedAccount = z.object({ unlinkedPhotos: z.number().int().min(0) });
