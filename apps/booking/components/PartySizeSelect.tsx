"use client";

const SIZES = Array.from({ length: 12 }, (_, i) => i + 1);

export function PartySizeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="text-sm font-medium text-ink-2">Party size</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 appearance-none rounded-md border border-rule bg-paper py-2 pl-3 pr-9 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size} {size === 1 ? "person" : "people"}
            </option>
          ))}
          <option value={13}>13+ — call us</option>
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}
