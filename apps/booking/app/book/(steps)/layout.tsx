import Link from "next/link";
import type { ReactNode } from "react";

import { StepProgress } from "../../../components/StepProgress";
import { ThemeToggle } from "../../../components/ThemeToggle";

export default function BookLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="font-display text-lg font-semibold text-ink transition-colors hover:text-primary"
          >
            The Italian Bistro
          </Link>
          <div className="flex items-center gap-3">
            <StepProgress />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
