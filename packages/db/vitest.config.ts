import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // These tests share one database and mutate it, so they must not run in
    // parallel against each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
