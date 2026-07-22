import { useEffect, useState } from "react";

/** The header's live clock (proposal §11's /today spec) — re-renders once a
 *  minute, not every second, since seconds are never shown. */
export function useLiveClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);

    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return now;
}
