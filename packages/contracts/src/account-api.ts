import { z } from "zod";
import { Uuid } from "./common";
import { ConsentRecord } from "./consent";
import { Lesson } from "./lesson";
import { LessonSources, LessonVisuals } from "./lesson-api";
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

/** Saving pins the version on screen, so later edits never change what was saved (#103). */
export const SaveLessonRequest = z.object({
  lessonId: Uuid,
  version: z.number().int().positive(),
});

export const SavedLesson = z.object({
  lessonId: Uuid,
  version: z.number().int().positive(),
  title: z.string(),
  savedAt: z.iso.datetime({ offset: true }),
  /** Set once the learner shared an anonymous copy for review (#104). */
  sharedAt: z.iso.datetime({ offset: true }).nullable().default(null),
});

/** Sharing is asked per lesson, at the moment it would happen, never as a standing setting. */
export const SharedLesson = z.object({
  sharedAt: z.iso.datetime({ offset: true }),
  reviewStatus: z.literal("needs-review"),
});

export const SavedLessons = z.object({ lessons: z.array(SavedLesson) });

// GET routes take query strings, so the id is the only field.
export const SavedLessonRequest = z.object({ lessonId: Uuid });

/** Exactly the saved version, with what the reader needs to show it; nothing is regenerated. */
export const OpenedLesson = z.object({
  savedAt: z.iso.datetime({ offset: true }),
  lesson: Lesson,
  sources: LessonSources,
  visuals: LessonVisuals,
});

/** Kept photos linked to the account download one by one from here, signed in. */
export const ACCOUNT_PHOTO_PATH = "/account/photos";

/** Everything we hold that is tied to the account, in one file the learner keeps (#105). */
export const AccountExport = z.object({
  exportedAt: z.iso.datetime({ offset: true }),
  account: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    ageAtSignup: z.number().int(),
    createdAt: z.iso.datetime({ offset: true }),
    signInMethods: z.array(z.enum(["password", "google"])),
    linkedAt: z.iso.datetime({ offset: true }).nullable(),
    consentVersion: z.string().nullable(),
  }),
  savedLessons: z.array(SavedLesson),
  photos: z.array(
    z.object({ key: PhotoKey, consentVersion: z.string().nullable(), download: z.string() }),
  ),
  notes: z.array(z.string()),
});

/** Typing the account's email confirms a deletion that cannot be undone. */
export const DeleteAccountRequest = z.object({ email: Email });

/** The photo keys deleted, so the device can drop them from its own list too. */
export const DeletedAccount = z.object({ deletedPhotos: z.array(PhotoKey) });
