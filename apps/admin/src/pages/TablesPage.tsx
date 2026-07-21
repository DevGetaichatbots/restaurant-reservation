import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClientError } from "@rms/api-client";
import { createTableSchema, type CreateTableRequest, type TableDto } from "@rms/contracts";
import { Button, cn } from "@rms/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { DataTable } from "../components/ui/DataTable";
import { Dialog } from "../components/ui/Dialog";
import { Input, Label } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import { Switch } from "../components/ui/Switch";
import { useCreateTable, useDeleteTable, useTables, useUpdateTable } from "../hooks/use-tables";

type TableRow = TableDto & { upcomingReservations: number };

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function TableFormDialog({
  open,
  onOpenChange,
  table,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: TableRow | null;
}) {
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const [pendingForceBody, setPendingForceBody] = useState<CreateTableRequest | null>(null);
  const [affected, setAffected] = useState<{ id: string; guestName: string; partySize: number }[] | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateTableRequest>({
    resolver: zodResolver(createTableSchema) as Resolver<CreateTableRequest>,
    defaultValues: table ?? { tableName: "", seats: 2, location: "Main Hall", status: "active", isTemporary: false },
    values: table ?? undefined,
  });

  const isSaving = createTable.isPending || updateTable.isPending;

  function submit(body: CreateTableRequest) {
    if (!table) {
      createTable.mutate(body, { onSuccess: () => onOpenChange(false) });
      return;
    }

    updateTable.mutate(
      { id: table.id, body },
      {
        onSuccess: () => {
          setAffected(null);
          onOpenChange(false);
        },
        onError: (error) => {
          if (error instanceof ApiClientError && error.code === "SEATS_BELOW_BOOKED_PARTY") {
            const details = error.details as { affected: { id: string; guestName: string; partySize: number }[] };
            setAffected(details.affected);
            setPendingForceBody(body);
            return;
          }
          toast.error(error instanceof Error ? error.message : "Could not update this table.");
        },
      },
    );
  }

  function confirmForce() {
    if (!table || !pendingForceBody) return;
    updateTable.mutate(
      { id: table.id, body: pendingForceBody, force: true },
      {
        onSuccess: () => {
          setAffected(null);
          setPendingForceBody(null);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <>
      <Dialog
        open={open && affected === null}
        onOpenChange={(next) => {
          if (!next) reset();
          onOpenChange(next);
        }}
        title={table ? `Edit ${table.tableName}` : "Add a table"}
      >
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="tableName">Table name</Label>
            <Input id="tableName" {...register("tableName")} />
            {errors.tableName && <p className="mt-1 text-sm text-danger">{errors.tableName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="seats">Seats</Label>
              <Input id="seats" type="number" min={1} {...register("seats", { valueAsNumber: true })} />
              {errors.seats && <p className="mt-1 text-sm text-danger">{errors.seats.message}</p>}
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register("location")} />
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={watch("status")}
              onValueChange={(value) => setValue("status", value as "active" | "inactive")}
              options={STATUS_OPTIONS}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-rule px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">Temporary table</p>
              <p className="text-xs text-ink-3">Extra seating for a busy night — easy to tell apart from the permanent grid.</p>
            </div>
            <Switch checked={watch("isTemporary")} onCheckedChange={(checked) => setValue("isTemporary", checked)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSaving}>
              {table ? "Save changes" : "Add table"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={affected !== null}
        onOpenChange={(next) => {
          if (!next) {
            setAffected(null);
            setPendingForceBody(null);
          }
        }}
        title="Some upcoming bookings won't fit"
        description="These parties are larger than the new seat count. Nothing is changed automatically — reassign or cancel them yourself, or apply the seat count anyway."
        confirmLabel="Apply anyway"
        variant="danger"
        loading={updateTable.isPending}
        onConfirm={confirmForce}
      >
        <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border border-rule p-3 text-sm">
          {(affected ?? []).map((r) => (
            <li key={r.id} className="flex justify-between text-ink-2">
              <span>{r.guestName}</span>
              <span>{r.partySize} guests</span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </>
  );
}

export function TablesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const tablesQuery = useTables(statusFilter === "all" ? {} : { status: statusFilter });
  const deleteTable = useDeleteTable();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TableRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TableRow | null>(null);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: TableRow) {
    setEditing(row);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteTable.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "This table couldn't be removed.",
        );
      },
    });
  }

  const columns: ColumnDef<TableRow>[] = [
    { accessorKey: "tableName", header: "Table" },
    { accessorKey: "seats", header: "Seats" },
    { accessorKey: "location", header: "Location" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
            row.original.status === "active" ? "bg-success-subtle text-success" : "bg-paper-3 text-ink-3",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
          {row.original.status === "active" ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "temporary",
      header: "Type",
      cell: ({ row }) => (row.original.isTemporary ? "Temporary" : "Permanent"),
    },
    { accessorKey: "upcomingReservations", header: "Upcoming" },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row.original);
            }}
            aria-label={`Edit ${row.original.tableName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-paper-3 hover:text-ink"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row.original);
            }}
            aria-label={`Remove ${row.original.tableName}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-danger-subtle hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tables"
        description="The physical table grid — what the availability engine matches guests against."
        actions={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter} options={[{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS]} className="w-40" />
            <Button onClick={openAdd}>
              <Plus size={16} /> Add table
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={tablesQuery.data ?? []}
        isLoading={tablesQuery.isLoading}
        emptyMessage="No tables yet — add your first one to start taking bookings."
      />

      <TableFormDialog open={formOpen} onOpenChange={setFormOpen} table={editing} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.tableName ?? "this table"}?`}
        description={
          deleteTarget && deleteTarget.upcomingReservations > 0
            ? `This table has ${deleteTarget.upcomingReservations} upcoming booking(s). Reassign or cancel them first — removing it here won't touch them, but the request will be refused until they're cleared.`
            : "This can't be undone. The table will no longer appear in availability."
        }
        confirmLabel="Remove table"
        variant="danger"
        loading={deleteTable.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
