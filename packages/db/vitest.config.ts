import { loadEnvFile } from "node:process";

import { defineConfig } from "vitest/config";

// Loads the repo-root .env so DATABASE_URL is available to the tests without
// requiring it to be exported in the shell first. Safe to skip if the file
// doesn't exist — CI supplies DATABASE_URL as a real environment variable.
try {
  loadEnvFile("../../.env");
} catch {
  // no .env present — fall through to whatever the environment already has
}

export default defineConfig({
  test: {
    // These tests share one database and mutate it, so they must not run in
    // parallel against each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
