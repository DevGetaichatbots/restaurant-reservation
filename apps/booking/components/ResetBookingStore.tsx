"use client";

import { useEffect } from "react";

import { useBookingStore } from "../lib/booking-store";

/** The booking is done — clears the in-progress selection so a guest who
 *  taps "Reserve a Table" again from Home starts a genuinely new booking
 *  rather than resuming this one's date/time/table. */
export function ResetBookingStore() {
  const reset = useBookingStore((s) => s.reset);
  useEffect(() => {
    reset();
  }, [reset]);
  return null;
}
