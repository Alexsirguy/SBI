import shared from "@sbi/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

// Integration tests share one database, so files must not run concurrently.
export default mergeConfig(shared, defineConfig({ test: { fileParallelism: false } }));
