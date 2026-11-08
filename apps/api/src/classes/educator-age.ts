import { HttpStatus } from "@nestjs/common";
import { EDUCATOR_MIN_AGE, UNDER_EDUCATOR_AGE } from "@sbi/contracts";
import { UserFacingException } from "../common/user-facing.exception";

/** Shared by sign-up and the /teach opt-in so both apply the same adults-only rule. */
export function checkEducatorAge(age: number) {
  if (age < EDUCATOR_MIN_AGE) {
    throw new UserFacingException(UNDER_EDUCATOR_AGE, HttpStatus.FORBIDDEN);
  }
}
