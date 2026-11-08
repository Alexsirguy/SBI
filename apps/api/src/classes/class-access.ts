import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { AudienceBand, SafetyCategory, type ClassControls } from "@sbi/contracts";
import type { ClassRepository, StoredClass } from "@sbi/db";
import { UserFacingException } from "../common/user-facing.exception";
import { CLASSES } from "../tokens";
import { hashJoinCode, parseJoinCode } from "./join-code";

export const CLASS_GONE =
  "This class link doesn't work any more. Ask your teacher for the new one.";

/** Stored controls, read back through the contract enums so unknown values are dropped. */
export function controlsOf(stored: StoredClass): ClassControls {
  const audience = AudienceBand.safeParse(stored.controls.audienceLock);
  return {
    audienceLock: audience.success ? audience.data : null,
    blockedCategories: stored.controls.blockedCategories.flatMap((category) => {
      const parsed = SafetyCategory.safeParse(category);
      return parsed.success ? [parsed.data] : [];
    }),
    tutorEnabled: stored.controls.tutorEnabled,
  };
}

/** Resolves a learner's class code to the class's controls; the code itself is never stored. */
@Injectable()
export class ClassAccess {
  constructor(@Inject(CLASSES) private readonly classes: Pick<ClassRepository, "findOpenByCode">) {}

  async find(code: string): Promise<StoredClass | undefined> {
    const canonical = parseJoinCode(code);
    return canonical ? this.classes.findOpenByCode(hashJoinCode(canonical)) : undefined;
  }

  /** The class's controls, or a 404 the learner can act on when the link no longer works. */
  async controls(code: string): Promise<ClassControls> {
    const found = await this.find(code);
    if (!found) throw new UserFacingException(CLASS_GONE, HttpStatus.NOT_FOUND);
    return controlsOf(found);
  }
}
