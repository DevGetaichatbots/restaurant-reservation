import type { TableAvailability } from "@rms/contracts";
import { Button, Card, cn, Spinner } from "@rms/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Input, Label } from "../components/ui/Input";
import { apiClient } from "../lib/api";
import { todayIso } from "../lib/date";

function nowTimeString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function WalkInsPage() {
  const queryClient = useQueryClient();
  const [partySize, setPartySize] = useState(2);
  const [selectedTable, setSelectedTable] = useState<TableAvailability | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const today = todayIso();
  const time = nowTimeString();

  const tablesQuery = useQuery({
    queryKey: ["availability", "tables", today, time, partySize],
    queryFn: () => apiClient.getTables(today, time, partySize),
  });

  const freeTables = (tablesQuery.data ?? []).filter((t) => t.status === "available");

  const seatWalkIn = useMutation({
    mutationFn: async () => {
      if (!selectedTable) throw new Error("Pick a table first.");
      const idempotencyKey = `walkin-${selectedTable.id}-${Date.now()}`;
      const { reservation } = await apiClient.createReservation(
        {
          tableId: selectedTable.id,
          guestName: guestName.trim() || "Walk-in guest",
          guestPhone: guestPhone.trim() || undefined,
          partySize,
          reservationDate: today,
          reservationTime: time,
          marketingOptIn: false,
          source: "walk_in",
        },
        idempotencyKey,
      );

      if (reservation.status === "confirmed") {
        await apiClient.performReservationAction(reservation.id, "seat");
      }
      return reservation;
    },
    onSuccess: (reservation) => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
      if (reservation.status === "confirmed") {
        toast.success(`${guestName.trim() || "Walk-in guest"} seated at ${selectedTable?.tableName}.`);
      } else {
        toast.warning("Booking mode is Manual right now — this walk-in needs approval in the Requests queue before seating.");
      }
      setSelectedTable(null);
      setGuestName("");
      setGuestPhone("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not seat this walk-in.");
    },
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card className="p-5">
        <p className="mb-3 text-base font-medium text-ink">Party size</p>
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Decrease party size"
            onClick={() => setPartySize((n) => Math.max(1, n - 1))}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-rule text-ink transition-colors hover:bg-paper-3"
          >
            <Minus size={22} />
          </button>
          <span className="w-16 text-center text-4xl font-semibold tabular-nums text-ink">{partySize}</span>
          <button
            type="button"
            aria-label="Increase party size"
            onClick={() => setPartySize((n) => Math.min(20, n + 1))}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-rule text-ink transition-colors hover:bg-paper-3"
          >
            <Plus size={22} />
          </button>
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-base font-medium text-ink">Free right now</p>
        {tablesQuery.isLoading ? (
          <Spinner className="mx-auto text-ink-3" />
        ) : freeTables.length === 0 ? (
          <p className="text-base text-ink-3">Nothing free for {partySize} right now — check again shortly, or add them to the request queue from the normal booking flow.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {freeTables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => setSelectedTable(table)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center rounded-lg border px-3 py-2 text-center transition-colors",
                  selectedTable?.id === table.id
                    ? "border-primary bg-primary text-primary-contrast"
                    : "border-rule bg-paper text-ink hover:border-primary/50 hover:bg-paper-2",
                )}
              >
                <span className="text-base font-semibold">{table.tableName}</span>
                <span className="text-xs opacity-80">{table.seats} seats · {table.location}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selectedTable && (
        <Card className="p-5">
          <p className="mb-3 text-base font-medium text-ink">Guest (optional)</p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="walkin-name">Name</Label>
              <Input id="walkin-name" placeholder="Optional" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="walkin-phone">Phone</Label>
              <Input id="walkin-phone" placeholder="Optional" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
            </div>
          </div>

          <Button
            fullWidth
            size="lg"
            className="mt-5"
            loading={seatWalkIn.isPending}
            onClick={() => seatWalkIn.mutate()}
          >
            Seat at {selectedTable.tableName}
          </Button>
        </Card>
      )}
    </div>
  );
}
