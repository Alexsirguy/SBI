import { join } from "node:path";
import { describeContract } from "@sbi/testing";
import { RecognitionResult } from "./recognition";
import { TutorTurn } from "./tutor";

const fixtures = join(import.meta.dirname, "fixtures");

describeContract("RecognitionResult", RecognitionResult, join(fixtures, "recognition-result"));
describeContract("TutorTurn", TutorTurn, join(fixtures, "tutor-turn"));
