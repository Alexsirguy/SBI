import { Controller, Get, HttpStatus, Inject, Query, Res } from "@nestjs/common";
import { VisualRequest } from "@sbi/contracts";
import { GALLERY_FIXTURES, type VisualManifestRepository } from "@sbi/visuals";
import { playgroundDocument } from "@sbi/visuals/playground-document";
import { UserFacingException } from "../common/user-facing.exception";
import { ZodPipe } from "../common/zod.pipe";
import type { ApiEnv } from "../env";
import { API_ENV, VISUAL_INTEGRITY, VISUAL_MANIFESTS } from "../tokens";
import type { SpecIntegrity } from "./integrity";

const GONE = "That visual is not available.";

// The only part of Fastify's reply this route uses; passthrough keeps Nest sending the body.
interface Reply {
  header(name: string, value: string): unknown;
}

/** Serves a playground's frame document from the API's origin, under its own CSP and sandbox. */
@Controller()
export class PlaygroundsController {
  constructor(
    @Inject(VISUAL_MANIFESTS) private readonly manifests: VisualManifestRepository,
    @Inject(VISUAL_INTEGRITY) private readonly intact: SpecIntegrity,
    @Inject(API_ENV) private readonly env: Pick<ApiEnv, "webOrigins">,
  ) {}

  @Get("/playgrounds")
  async get(
    @Query(new ZodPipe(VisualRequest, "Name one visual by its id.")) { visualId }: VisualRequest,
    @Res({ passthrough: true }) reply: Reply,
  ): Promise<string> {
    // The gallery's hand-written playgrounds are served too, so its page needs no database.
    const manifest =
      (await this.manifests.get(visualId)) ??
      GALLERY_FIXTURES.find((item) => item.visualId === visualId);
    const code = (manifest?.spec as { code?: unknown } | undefined)?.code;
    if (manifest?.kind !== "playground" || typeof code !== "string") {
      throw new UserFacingException(GONE, HttpStatus.NOT_FOUND);
    }
    if (!(await this.intact(manifest))) {
      throw new UserFacingException(
        "This visual changed after it was checked.",
        HttpStatus.CONFLICT,
      );
    }
    const { html, csp } = await playgroundDocument(code, { frameAncestors: this.env.webOrigins });
    // Set only on success, so an error still leaves as the contract's JSON.
    reply.header("content-type", "text/html; charset=utf-8");
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("content-security-policy", csp);
    // A visual never changes under its id; a new one gets a new id.
    reply.header("cache-control", "public, max-age=31536000, immutable");
    return html;
  }
}
