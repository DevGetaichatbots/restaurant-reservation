import { buildApp } from "./app.js";
import { env } from "./config/env.js";

/**
 * Process entry point.
 *
 * Boots the app and shuts it down cleanly on SIGINT/SIGTERM. The graceful
 * shutdown matters more here than in a typical API: this service holds
 * long-lived SSE connections open, and a hard exit would drop them without
 * letting clients know to reconnect.
 */
async function main() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.log.error({ error }, "error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    // 0.0.0.0 rather than localhost — inside a container the service must be
    // reachable from outside it.
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error({ error }, "failed to start");
    process.exit(1);
  }
}

void main();
