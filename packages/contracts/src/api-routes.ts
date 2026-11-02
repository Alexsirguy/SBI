import type { z } from "zod";
import {
  Account,
  AccountRequest,
  LinkAccountRequest,
  LinkedAccount,
  UnlinkAccountRequest,
  UnlinkedAccount,
} from "./account-api";
import { Lesson } from "./lesson";
import {
  LessonFeedbackReceipt,
  LessonFeedbackRequest,
  LessonRequest,
  QuestionSuggestionRequest,
  QuestionSuggestions,
} from "./lesson-api";
import {
  ConfirmedPhoto,
  ConfirmUploadRequest,
  DeletedPhoto,
  DeletePhotoRequest,
  KeepPhotoRequest,
  KeptPhoto,
  UploadRequest,
  UploadTicket,
} from "./media-api";
import {
  RecognisedPhoto,
  RecognisePhotoRequest,
  RecordedSelection,
  RecordSelectionRequest,
} from "./recognition-api";
import {
  ObservationMatches,
  ObservationRequest,
  TaxonomySearchRequest,
  TaxonomySearchResults,
} from "./taxonomy-api";
import { ServedVisual, VisualRequest } from "./visual";

// GET routes take their request as query parameters, so their request schemas hold strings only.
// Routes marked `auth: "account"` need a bearer token from the sign-in provider.
/** HTTP routes served by `apps/api`; the web client and OpenAPI document both read this table. */
export const API_ROUTES = {
  requestUpload: {
    method: "post",
    path: "/uploads",
    summary: "Issue a presigned upload URL and a confirm token for one photo.",
    request: UploadRequest,
    response: UploadTicket,
    errors: [400, 503],
  },
  confirmUpload: {
    method: "post",
    path: "/uploads/confirm",
    summary: "Scan, strip and store an uploaded photo under its private key.",
    request: ConfirmUploadRequest,
    response: ConfirmedPhoto,
    errors: [400, 502, 503],
  },
  recognisePhoto: {
    method: "post",
    path: "/recognitions",
    summary: "Recognise a stored photo and say whether to proceed, ask, or fall back.",
    request: RecognisePhotoRequest,
    response: RecognisedPhoto,
    errors: [400, 404, 503],
  },
  recordSelection: {
    method: "post",
    path: "/recognitions/selection",
    summary: "Record the object the learner confirmed, or their own words for it.",
    request: RecordSelectionRequest,
    response: RecordedSelection,
    errors: [400, 404],
  },
  noticeObject: {
    method: "post",
    path: "/observations",
    summary: "Match what a learner noticed to objects, and note the gap when nothing fits.",
    request: ObservationRequest,
    response: ObservationMatches,
    errors: [400],
  },
  searchTaxonomy: {
    method: "get",
    path: "/taxonomy/search",
    summary: "Find objects by name or related word, best match first.",
    request: TaxonomySearchRequest,
    response: TaxonomySearchResults,
    errors: [400],
  },
  keepPhoto: {
    method: "post",
    path: "/photos/keep",
    summary: "Exempt a stored photo from automatic deletion.",
    request: KeepPhotoRequest,
    response: KeptPhoto,
    errors: [400, 409, 502, 503],
  },
  deletePhoto: {
    method: "post",
    path: "/photos/delete",
    summary: "Delete a stored photo now, whether or not it was kept.",
    request: DeletePhotoRequest,
    response: DeletedPhoto,
    errors: [400, 502],
  },
  submitLessonFeedback: {
    method: "post",
    path: "/lessons/feedback",
    summary: "Report a problem with, or rate, one version of a lesson.",
    request: LessonFeedbackRequest,
    response: LessonFeedbackReceipt,
    errors: [400, 404],
  },
  suggestQuestions: {
    method: "post",
    path: "/lessons/questions",
    summary:
      "Suggest five questions a learner might ask about an object, before any lesson is written.",
    request: QuestionSuggestionRequest,
    response: QuestionSuggestions,
    errors: [400],
  },
  requestLesson: {
    method: "post",
    path: "/lessons",
    summary:
      "Generate or reuse a lesson, streaming progress, a checked quick answer, then the full lesson and its visuals.",
    request: LessonRequest,
    response: Lesson,
    errors: [400, 404, 503],
  },
  getVisual: {
    method: "get",
    path: "/visuals",
    summary: "Fetch the manifest of one visual a lesson references.",
    request: VisualRequest,
    response: ServedVisual,
    errors: [400, 404],
  },
  getAccount: {
    method: "get",
    path: "/account",
    summary: "Return the signed-in account, creating it on first sign-in.",
    request: AccountRequest,
    response: Account,
    errors: [401, 503],
    auth: "account",
  },
  linkAccount: {
    method: "post",
    path: "/account/link",
    summary: "Link this device's kept photos to the signed-in account, with the account opt-in.",
    request: LinkAccountRequest,
    response: LinkedAccount,
    errors: [400, 401, 503],
    auth: "account",
  },
  unlinkAccount: {
    method: "post",
    path: "/account/unlink",
    summary: "Withdraw the account opt-in: kept photos go back to being found on the device only.",
    request: UnlinkAccountRequest,
    response: UnlinkedAccount,
    errors: [401, 503],
    auth: "account",
  },
} as const;

/** True for routes that need a signed-in account. */
export function needsAccount(name: ApiRouteName): boolean {
  return (API_ROUTES[name] as { auth?: string }).auth === "account";
}

export type ApiRouteName = keyof typeof API_ROUTES;
export type ApiRequest<N extends ApiRouteName> = z.input<(typeof API_ROUTES)[N]["request"]>;
export type ApiResponse<N extends ApiRouteName> = z.output<(typeof API_ROUTES)[N]["response"]>;
