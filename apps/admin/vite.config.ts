import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Plain React SPA behind a login (proposal §03): no SEO value, no
// first-paint pressure, so there is no reason to pay for server rendering
// the way the guest booking page does. Ships as static files.
export default defineConfig({
  plugins: [react()],
  server: { port: 3001, host: true },
});
