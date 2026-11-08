import { Module } from "@nestjs/common";
import type { Repositories } from "@sbi/db";
import { CLASSES, REPOSITORIES } from "../tokens";
import { ClassAccess } from "./class-access";

// Kept apart from the class routes so the lesson and tutor modules can apply controls without a cycle.
@Module({
  providers: [
    ClassAccess,
    { provide: CLASSES, inject: [REPOSITORIES], useFactory: (r: Repositories) => r.classes },
  ],
  exports: [ClassAccess, CLASSES],
})
export class ClassAccessModule {}
