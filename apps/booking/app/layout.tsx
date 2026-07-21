import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "./providers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Reserve a Table — The Italian Bistro",
    template: "%s — The Italian Bistro",
  },
  description: "Reserve your table at The Italian Bistro in under a minute — real-time availability, instant confirmation.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "hsl(38 42% 97%)" },
    { media: "(prefers-color-scheme: dark)", color: "hsl(24 20% 8%)" },
  ],
};

/**
 * Runs before paint, blocking, to read a saved theme preference and stamp it
 * on <html> — without this, a returning guest who chose dark mode would see
 * one light-mode frame flash before ThemeToggle's own effect catches up.
 */
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem("rms-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="texture-paper font-body antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
