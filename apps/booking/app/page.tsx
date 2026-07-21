import Link from "next/link";

import { Button } from "@rms/ui";

import { ThemeToggle } from "../components/ThemeToggle";
import { apiClient } from "../lib/api";

// Revalidates every 60s — the open/closed badge stays accurate without a
// full page rebuild, and this stays a static, server-rendered response the
// rest of the time (the LCP budget this page is held to, per proposal §09,
// depends on not doing a client-side fetch before the first paint).
export const revalidate = 60;

const TRUST_CUES = [
  { label: "Quick & easy", icon: BoltIcon },
  { label: "Real-time availability", icon: PulseIcon },
  { label: "Secure booking", icon: ShieldIcon },
  { label: "Instant confirmation", icon: CheckIcon },
] as const;

export default async function LandingPage() {
  const restaurant = await apiClient.getRestaurant().catch(() => null);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <ThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pb-10 pt-6 sm:px-6 sm:pt-10">
        <section className="animate-fade-up rounded-lg border border-rule bg-paper-2 p-6 shadow-md sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium tracking-wide text-secondary">Reservations</p>
              <h1 className="mt-1 font-display text-3xl font-medium leading-tight text-ink">
                {restaurant?.name ?? "The Italian Bistro"}
              </h1>
            </div>
            <OpenBadge isOpen={restaurant?.isOpenNow} />
          </div>

          {restaurant?.address && <p className="mt-3 text-sm text-ink-2">{restaurant.address}</p>}

          <Link href="/book/date" className="mt-7 block">
            <Button size="lg" fullWidth>
              Reserve a Table
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </Link>
        </section>

        <ul className="mt-8 grid grid-cols-2 gap-3">
          {TRUST_CUES.map(({ label, icon: Icon }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 rounded-md border border-rule bg-paper px-3 py-2.5 text-sm text-ink-2"
            >
              <Icon />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </main>

      <footer className="px-5 pb-6 text-center text-xs text-ink-3">
        Powered by a reservation system {restaurant?.name ?? "The Italian Bistro"} owns outright.
      </footer>
    </div>
  );
}

function OpenBadge({ isOpen }: { isOpen: boolean | undefined }) {
  if (isOpen === undefined) return null;
  return (
    <span
      className={
        "mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " +
        (isOpen ? "bg-success-subtle text-success" : "bg-paper-3 text-ink-3")
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {isOpen ? "Open now" : "Closed now"}
    </span>
  );
}

function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-primary" aria-hidden="true">
      <path d="M11 2 4 12h5l-1 6 7-10h-5l1-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-primary" aria-hidden="true">
      <path d="M2 10h3l2-5 3 10 2-5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-primary" aria-hidden="true">
      <path d="M10 2 4 4.5v5c0 4 2.5 6.7 6 8.5 3.5-1.8 6-4.5 6-8.5v-5L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-primary" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 10 9 12.5l4.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
