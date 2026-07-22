const SOURCE_LABELS: Record<string, string> = {
  gmb: "Google (Reserve a Table)",
  direct: "Direct / website",
  walk_in: "Walk-in",
  phone: "Phone",
};

export function formatSource(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}
