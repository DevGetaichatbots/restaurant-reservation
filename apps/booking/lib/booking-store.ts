import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The guest's in-progress selection, carried across Steps 2–5.
 *
 * Each step has its own URL (proposal §09) specifically so the phone's back
 * button works and a half-finished booking survives a refresh — this store
 * is what makes the second half of that promise true. `sessionStorage`
 * rather than `localStorage`: the lifetime of "still mid-booking" is one
 * browser session, not indefinitely — a guest returning next week should
 * start fresh, not find a stale half-filled form.
 */
export interface BookingSelection {
  partySize: number;
  date: string | null;
  time: string | null;
  tableId: string | null;
  tableName: string | null;
  /** True once the guest has been routed onto the request path — no table
   *  fit, but the restaurant will still take a request (proposal §07). */
  onRequestPath: boolean;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  marketingOptIn: boolean;
}

interface BookingStore extends BookingSelection {
  setPartySize: (n: number) => void;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  chooseTable: (tableId: string, tableName: string) => void;
  chooseRequestPath: () => void;
  setGuestDetails: (details: Pick<BookingSelection, "guestName" | "guestPhone" | "guestEmail" | "marketingOptIn">) => void;
  reset: () => void;
}

const initialSelection: BookingSelection = {
  partySize: 2,
  date: null,
  time: null,
  tableId: null,
  tableName: null,
  onRequestPath: false,
  guestName: "",
  guestPhone: "",
  guestEmail: "",
  marketingOptIn: false,
};

export const useBookingStore = create<BookingStore>()(
  persist(
    (set) => ({
      ...initialSelection,
      setPartySize: (partySize) =>
        set({ partySize, tableId: null, tableName: null, onRequestPath: false }),
      setDate: (date) => set({ date, time: null, tableId: null, tableName: null, onRequestPath: false }),
      setTime: (time) => set({ time, tableId: null, tableName: null, onRequestPath: false }),
      chooseTable: (tableId, tableName) => set({ tableId, tableName, onRequestPath: false }),
      chooseRequestPath: () => set({ tableId: null, tableName: null, onRequestPath: true }),
      setGuestDetails: (details) => set(details),
      reset: () => set(initialSelection),
    }),
    {
      name: "rms-booking-selection",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
