import base from "@sbi/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    // Many tests boot the whole Nest app; on CI's 2-CPU runner beside every other package's tests, 5s is too tight.
    test: { testTimeout: 20_000, hookTimeout: 20_000 },
  }),
);
