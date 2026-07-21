import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import { cn } from "@rms/ui";

export const Tabs = RadixTabs.Root;

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <RadixTabs.List className={cn("inline-flex items-center gap-1 rounded-md border border-rule bg-paper p-1", className)}>
      {children}
    </RadixTabs.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className="rounded-sm px-4 py-2 text-sm font-medium text-ink-2 outline-none transition-colors data-[state=active]:bg-primary data-[state=active]:text-primary-contrast data-[state=inactive]:hover:bg-paper-3"
    >
      {children}
    </RadixTabs.Trigger>
  );
}

export const TabsContent = RadixTabs.Content;
