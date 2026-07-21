import type { DayHours, TimeSlotDto } from "@rms/contracts";
import { Button, Spinner } from "@rms/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable } from "../components/ui/DataTable";
import { Dialog } from "../components/ui/Dialog";
import { Input, Label } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Switch } from "../components/ui/Switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/Tabs";
import { useCreateSlot, useDeleteSlot, useHours, useSetHours, useSlots } from "../hooks/use-availability-settings";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function OpeningHoursTab() {
  const hoursQuery = useHours();
  const setHours = useSetHours();
  const [draft, setDraft] = useState<DayHours[] | null>(null);

  useEffect(() => {
    if (hoursQuery.data) setDraft(hoursQuery.data.map(({ dayOfWeek, openTime, closeTime, isOpen }) => ({ dayOfWeek, openTime, closeTime, isOpen })));
  }, [hoursQuery.data]);

  if (hoursQuery.isLoading || !draft) return <Spinner className="mx-auto mt-8 text-ink-3" />;

  function update(dayOfWeek: number, patch: Partial<DayHours>) {
    setDraft((current) => current!.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(hoursQuery.data?.map(({ dayOfWeek, openTime, closeTime, isOpen }) => ({ dayOfWeek, openTime, closeTime, isOpen })));

  return (
    <div className="rounded-lg border border-rule bg-paper p-5">
      <div className="space-y-3">
        {draft
          .slice()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map((day) => (
            <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-4 border-b border-rule pb-3 last:border-0 last:pb-0">
              <span className="w-28 shrink-0 text-sm font-medium text-ink">{DAY_NAMES[day.dayOfWeek]}</span>
              <Switch checked={day.isOpen} onCheckedChange={(isOpen) => update(day.dayOfWeek, { isOpen })} />
              {day.isOpen ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.openTime.slice(0, 5)}
                    onChange={(e) => update(day.dayOfWeek, { openTime: e.target.value })}
                    className="w-32"
                  />
                  <span className="text-ink-3">to</span>
                  <Input
                    type="time"
                    value={day.closeTime.slice(0, 5)}
                    onChange={(e) => update(day.dayOfWeek, { closeTime: e.target.value })}
                    className="w-32"
                  />
                </div>
              ) : (
                <span className="text-sm text-ink-3">Closed</span>
              )}
            </div>
          ))}
      </div>

      <div className="mt-5 flex justify-end">
        <Button
          disabled={!dirty}
          loading={setHours.isPending}
          onClick={() => setHours.mutate({ days: draft })}
        >
          Save hours
        </Button>
      </div>
    </div>
  );
}

function SlotsTab() {
  const slotsQuery = useSlots();
  const createSlot = useCreateSlot();
  const deleteSlot = useDeleteSlot();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TimeSlotDto | null>(null);
  const [form, setForm] = useState({ startTime: "18:00", endTime: "18:30", durationMinutes: 90 });

  function submitAdd() {
    createSlot.mutate(
      { ...form, isActive: true },
      {
        onSuccess: () => setAddOpen(false),
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Could not add this time slot.");
        },
      },
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteSlot.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Could not remove this time slot.");
      },
    });
  }

  const columns: ColumnDef<TimeSlotDto>[] = [
    { accessorKey: "startTime", header: "Start", cell: ({ row }) => row.original.startTime.slice(0, 5) },
    { accessorKey: "endTime", header: "End", cell: ({ row }) => row.original.endTime.slice(0, 5) },
    { accessorKey: "durationMinutes", header: "Seating length (min)" },
    { accessorKey: "isActive", header: "Active", cell: ({ row }) => (row.original.isActive ? "Yes" : "No") },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setDeleteTarget(row.original)}
          aria-label="Remove slot"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-danger-subtle hover:text-danger"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} /> Add time slot
        </Button>
      </div>

      <DataTable columns={columns} data={slotsQuery.data ?? []} isLoading={slotsQuery.isLoading} emptyMessage="No time slots configured." />

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add a time slot">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start time</Label>
              <Input
                id="startTime"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="endTime">End time</Label>
              <Input
                id="endTime"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="durationMinutes">Seating length (minutes)</Label>
            <Input
              id="durationMinutes"
              type="number"
              min={15}
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" loading={createSlot.isPending} onClick={submitAdd}>
              Add slot
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title="Remove this time slot?"
        description="Guests will no longer be able to book this start time. Existing bookings are unaffected."
        confirmLabel="Remove"
        variant="danger"
        loading={deleteSlot.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export function AvailabilityPage() {
  return (
    <div>
      <PageHeader title="Availability" description="When guests can book, and how long each seating runs." />
      <Tabs defaultValue="hours">
        <TabsList className="mb-4">
          <TabsTrigger value="hours">Opening hours</TabsTrigger>
          <TabsTrigger value="slots">Time slots</TabsTrigger>
        </TabsList>
        <TabsContent value="hours">
          <OpeningHoursTab />
        </TabsContent>
        <TabsContent value="slots">
          <SlotsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
