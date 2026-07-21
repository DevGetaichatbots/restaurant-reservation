import type { NextConfig } from "next";

/**
 * Workspace packages ship raw TypeScript source, not a pre-built dist —
 * standard for a monorepo where the API and the front-ends consume the same
 * .ts files directly rather than round-tripping through a build step.
 * `transpilePackages` is what tells Next.js to compile these itself instead
 * of trying to import them as already-built JS.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@rms/ui", "@rms/api-client", "@rms/contracts", "@rms/rules", "@rms/realtime"],
};

export default nextConfig;
