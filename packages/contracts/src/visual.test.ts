import { join } from "node:path";
import { describeContract } from "@sbi/testing";
import { VisualAsset, VisualManifest } from "./visual";

const fixtures = join(import.meta.dirname, "fixtures");

describeContract("VisualAsset", VisualAsset, join(fixtures, "visual-asset"));
describeContract("VisualManifest", VisualManifest, join(fixtures, "visual-manifest"));
