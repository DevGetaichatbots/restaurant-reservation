/** Local calendar date as YYYY-MM-DD — deliberately not `toISOString().slice(0, 10)`,
 *  which reports the UTC date and would show "yesterday" for hours after
 *  local midnight in timezones ahead of UTC. Staff read this dashboard on
 *  the restaurant's own floor, so the browser's local date is the right one. */
export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateLong(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "19:30" -> "7:30 PM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
