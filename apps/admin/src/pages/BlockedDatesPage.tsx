import type { BlockedDateDto } from "@rms/contracts";
import { Button } from "@rms/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable } from "../components/ui/DataTable";
import { Dialog } from "../components/ui/Dialog";
import { Input, Label } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { formatDateLong } from "../lib/date";
import {
  useBlockDate,
  useBlockDateRange,
  useBlockedDates,
  useUnblockDate,
} from "../hooks/use-availability-settings";

export function BlockedDatesPage() {
  const blockedDatesQuery = useBlockedDates();
  const blockDate = useBlockDate();
  const blockRange = useBlockDateRange();
  const unblockDate = useUnblockDate();

  const [addOpen, setAddOpen] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<BlockedDateDto | null>(null);
  const [singleForm, setSingleForm] = useState({ blockedDate: "", reason: "" });
  const [rangeForm, setRangeForm] = useState({ startDate: "", endDate: "", reason: "" });

  function submitSingle() {
    if (!singleForm.blockedDate) return;
    blockDate.mutate(
      { blockedDate: singleForm.blockedDate, reason: singleForm.reason || null },
      { onSuccess: () => setAddOpen(false) },
    );
  }

  function submitRange() {
    if (!rangeForm.startDate || !rangeForm.endDate) return;
    blockRange.mutate(
      { startDate: rangeForm.startDate, endDate: rangeForm.endDate, reason: rangeForm.reason || null },
      { onSuccess: () => setAddOpen(false) },
    );
  }

  const columns: ColumnDef<BlockedDateDto>[] = [
    { accessorKey: "blockedDate", header: "Date", cell: ({ row }) => formatDateLong(row.original.blockedDate) },
    { accessorKey: "reason", header: "Reason", cell: ({ row }) => row.original.reason ?? "—" },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setUnblockTarget(row.original)}
          aria-label="Unblock date"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-danger-subtle hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Blocked dates"
        description="Holidays, private events, and closures. Blocking a date never touches bookings already made on it."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Block date
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={blockedDatesQuery.data ?? []}
        isLoading={blockedDatesQuery.isLoading}
        emptyMessage="No dates blocked."
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Block dates">
        <Tabs defaultValue="single">
          <TabsList className="mb-4">
            <TabsTrigger value="single">Single date</TabsTrigger>
            <TabsTrigger value="range">Date range</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <div>
              <Label htmlFor="blockedDate">Date</Label>
              <Input
                id="blockedDate"
                type="date"
                value={singleForm.blockedDate}
                onChange={(e) => setSingleForm((f) => ({ ...f, blockedDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                placeholder="e.g. Private event"
                value={singleForm.reason}
                onChange={(e) => setSingleForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="button" loading={blockDate.isPending} onClick={submitSingle} disabled={!singleForm.blockedDate}>
                Block date
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="range" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">From</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={rangeForm.startDate}
                  onChange={(e) => setRangeForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endDate">To</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={rangeForm.endDate}
                  onChange={(e) => setRangeForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="rangeReason">Reason (optional)</Label>
              <Input
                id="rangeReason"
                placeholder="e.g. Holiday closure"
                value={rangeForm.reason}
                onChange={(e) => setRangeForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                loading={blockRange.isPending}
                onClick={submitRange}
                disabled={!rangeForm.startDate || !rangeForm.endDate}
              >
                Block range
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </Dialog>

      <ConfirmDialog
        open={unblockTarget !== null}
        onOpenChange={(next) => !next && setUnblockTarget(null)}
        title={unblockTarget ? `Unblock ${formatDateLong(unblockTarget.blockedDate)}?` : "Unblock this date?"}
        description="Guests will be able to book this date again."
        confirmLabel="Unblock"
        variant="danger"
        loading={unblockDate.isPending}
        onConfirm={() => unblockTarget && unblockDate.mutate(unblockTarget.id, { onSuccess: () => setUnblockTarget(null) })}
      />
    </div>
  );
}
