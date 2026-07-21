import { Card, Spinner } from "@rms/ui";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { useReportsSummary } from "../hooks/use-reports";
import { formatDateShort, todayIso } from "../lib/date";
import { formatSource } from "../lib/format";

// Fixed categorical order, drawn from the same brand/status tokens as the
// rest of the app (tokens.css) rather than a generated or cycled palette —
// dataviz skill's "assign categorical hues in fixed order" rule.
const CHART_COLORS = {
  primary: "var(--color-primary)",
  secondary: "var(--color-secondary)",
  accent: "var(--color-accent)",
  info: "var(--color-info)",
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  muted: "var(--color-ink-3)",
};

const SOURCE_COLOR: Record<string, string> = {
  gmb: CHART_COLORS.primary,
  direct: CHART_COLORS.secondary,
  walk_in: CHART_COLORS.accent,
  phone: CHART_COLORS.info,
};

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </Card>
  );
}

function ChartCard({ title, children, table }: { title: string; children: ReactNode; table?: ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-display text-lg text-ink">{title}</h2>
      {children}
      {table && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-ink-3 hover:text-ink">View as table</summary>
          <div className="mt-2">{table}</div>
        </details>
      )}
    </Card>
  );
}

function tooltipStyle() {
  return {
    backgroundColor: "var(--color-paper)",
    border: "1px solid var(--color-rule)",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--color-ink)",
  };
}

export function ReportsPage() {
  const [from, setFrom] = useState(daysAgoIso(29));
  const [to, setTo] = useState(todayIso());

  const summaryQuery = useReportsSummary(from, to);
  const summary = summaryQuery.data;

  const bookingsPerDay = useMemo(
    () => (summary?.bookingsPerDay ?? []).map((d) => ({ ...d, label: formatDateShort(d.date) })),
    [summary],
  );

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Bookings, occupancy, and no-shows over the selected period."
        actions={
          <>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            <span className="self-center text-ink-3">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </>
        }
      />

      {summaryQuery.isLoading || !summary ? (
        <Spinner className="mx-auto mt-8 text-ink-3" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Total bookings" value={String(summary.totalBookings)} />
            <StatTile label="Completed" value={String(summary.completedBookings)} />
            <StatTile label="Total covers" value={String(summary.totalCovers)} />
            <StatTile label="Avg. party size" value={summary.averagePartySize.toFixed(1)} />
            <StatTile label="No-show rate" value={`${(summary.noShowRate * 100).toFixed(1)}%`} />
            <StatTile label="Cancellation rate" value={`${(summary.cancellationRate * 100).toFixed(1)}%`} />
          </div>

          <ChartCard
            title="Bookings per day"
            table={
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-ink-3">
                    <th className="py-1 pr-4">Date</th>
                    <th className="py-1">Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingsPerDay.map((d) => (
                    <tr key={d.date} className="border-t border-rule">
                      <td className="py-1 pr-4 text-ink">{d.label}</td>
                      <td className="py-1 text-ink">{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={bookingsPerDay} margin={{ left: -20 }}>
                <CartesianGrid vertical={false} stroke="var(--color-rule)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-ink-3)" }} axisLine={{ stroke: "var(--color-rule)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-ink-3)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle()} />
                <Line type="monotone" dataKey="count" name="Bookings" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard
              title="Bookings by source"
              table={
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-ink-3">
                      <th className="py-1 pr-4">Source</th>
                      <th className="py-1">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sourceBreakdown.map((s) => (
                      <tr key={s.source} className="border-t border-rule">
                        <td className="py-1 pr-4 text-ink">{formatSource(s.source)}</td>
                        <td className="py-1 text-ink">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <ResponsiveContainer width="100%" height={Math.max(180, summary.sourceBreakdown.length * 48)}>
                <BarChart
                  data={summary.sourceBreakdown.map((s) => ({ ...s, label: formatSource(s.source) }))}
                  layout="vertical"
                  margin={{ left: 24 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--color-rule)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-ink-3)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: "var(--color-ink)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "var(--color-paper-3)" }} />
                  <Bar dataKey="count" name="Bookings" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {summary.sourceBreakdown.map((s) => (
                      <Cell key={s.source} fill={SOURCE_COLOR[s.source] ?? CHART_COLORS.muted} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Overflow requests"
              table={
                <table className="w-full text-left text-xs">
                  <tbody>
                    <tr className="border-t border-rule">
                      <td className="py-1 pr-4 text-ink">Accepted</td>
                      <td className="py-1 text-ink">{summary.overflow.accepted}</td>
                    </tr>
                    <tr className="border-t border-rule">
                      <td className="py-1 pr-4 text-ink">Declined</td>
                      <td className="py-1 text-ink">{summary.overflow.declined}</td>
                    </tr>
                    <tr className="border-t border-rule">
                      <td className="py-1 pr-4 text-ink">Expired</td>
                      <td className="py-1 text-ink">{summary.overflow.expired}</td>
                    </tr>
                  </tbody>
                </table>
              }
            >
              <div className="mb-3 text-sm text-ink-3">
                Accept rate: <span className="font-medium text-ink">{(summary.overflow.acceptRate * 100).toFixed(0)}%</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={[
                    { label: "Accepted", value: summary.overflow.accepted, fill: CHART_COLORS.success },
                    { label: "Declined", value: summary.overflow.declined, fill: CHART_COLORS.danger },
                    { label: "Expired", value: summary.overflow.expired, fill: CHART_COLORS.muted },
                  ]}
                  layout="vertical"
                  margin={{ left: 8 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--color-rule)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-ink-3)" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 12, fill: "var(--color-ink)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "var(--color-paper-3)" }} />
                  <Bar dataKey="value" name="Requests" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {[CHART_COLORS.success, CHART_COLORS.danger, CHART_COLORS.muted].map((fill, i) => (
                      <Cell key={i} fill={fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard
            title="Table utilization"
            table={
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-ink-3">
                    <th className="py-1 pr-4">Table</th>
                    <th className="py-1 pr-4">Bookings</th>
                    <th className="py-1">Covers</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.tableUtilization.map((t) => (
                    <tr key={t.tableId} className="border-t border-rule">
                      <td className="py-1 pr-4 text-ink">{t.tableName}</td>
                      <td className="py-1 pr-4 text-ink">{t.bookings}</td>
                      <td className="py-1 text-ink">{t.covers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            }
          >
            <ResponsiveContainer width="100%" height={Math.max(220, summary.tableUtilization.length * 40)}>
              <BarChart data={summary.tableUtilization} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-rule)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-ink-3)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="tableName" width={90} tick={{ fontSize: 12, fill: "var(--color-ink)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "var(--color-paper-3)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-ink-2)" }} />
                <Bar dataKey="bookings" name="Bookings" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                <Bar dataKey="covers" name="Covers" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
