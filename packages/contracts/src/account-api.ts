import { z } from "zod";
import { Uuid } from "./common";
import { ConsentRecord } from "./consent";
import { PhotoKey } from "./media-api";

/** Accounts are for 13 and over only; younger learners use everything without one (ADR 0020). */
export const MIN_ACCOUNT_AGE = 13;
export const UNDER_MIN_AGE =
  "You need to be 13 or older to make an account. Ask a grown-up — everything here works without one.";

const Name = z.string().trim().min(1, "Enter your name.").max(80);
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email address."));
// Length over composition rules (NIST 800-63B); common passwords are refused by the API.
export const NewPassword = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");
const Age = z.coerce.number().int("Enter your age in whole years.").min(0).max(120);
const Token = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "This link is not valid.");

export const SignUpRequest = z.object({
  firstName: Name,
  lastName: Name,
  age: Age,
  email: Email,
  password: NewPassword,
});

export const SignInRequest = z.object({
  email: Email,
  password: z.string().min(1, "Enter your password.").max(128),
});

/** Google's ID token from its own button; checked by the API against Google's keys. */
const GoogleCredential = z.string().min(20).max(4096);

export const GoogleSignInRequest = z.object({ credential: GoogleCredential });

/** A new Google user still owes us their age (13+ check) before an account exists. */
export const GoogleSignInResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("signed-in") }),
  z.object({
    status: z.literal("needs-details"),
    firstName: z.string(),
    lastName: z.string(),
  }),
]);

export const FinishGoogleSignUpRequest = z.object({
  credential: GoogleCredential,
  firstName: Name,
  lastName: Name,
  age: Age,
});

export const VerifyEmailRequest = z.object({ token: Token });
export const ForgotPasswordRequest = z.object({ email: Email });
export const ResetPasswordRequest = z.object({ token: Token, password: NewPassword });
export const EmptyRequest = z.object({});

export const Done = z.object({ ok: z.literal(true) });

/** What the account page shows; age stays on the server. */
export const Account = z.object({
  accountId: Uuid,
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  linkedAt: z.iso.datetime({ offset: true }).nullable(),
});

/** Linking needs the account opt-in under current wording; photos travel by their private keys. */
export const LinkAccountRequest = z.object({
  consent: ConsentRecord,
  photoKeys: z.array(PhotoKey).max(200),
});

export const LinkedAccount = z.object({ accountId: Uuid, linkedPhotos: z.number().int().min(0) });

export const UnlinkedAccount = z.object({ unlinkedPhotos: z.number().int().min(0) });
