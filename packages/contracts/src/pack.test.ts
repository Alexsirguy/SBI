import { join } from "node:path";
import { describeContract } from "@sbi/testing";
import { LessonPack } from "./pack";

describeContract("LessonPack", LessonPack, join(import.meta.dirname, "fixtures/lesson-pack"));
