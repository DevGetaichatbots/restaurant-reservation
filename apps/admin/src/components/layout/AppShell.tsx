import { Outlet } from "react-router-dom";

import { ThemeToggle } from "../ThemeToggle";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-dvh bg-paper-2">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-end border-b border-rule bg-paper px-6">
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
