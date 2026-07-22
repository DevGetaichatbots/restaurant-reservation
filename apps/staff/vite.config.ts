import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A tablet sitting at the host stand on the restaurant's own Wi-Fi (proposal
// §11): host:true so it's reachable at the LAN IP, matching the pattern
// already used for the booking and admin apps.
export default defineConfig({
  plugins: [react()],
  server: { port: 3002, host: true },
});
