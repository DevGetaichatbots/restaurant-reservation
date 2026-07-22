import type { ReservationChangedPayload } from "./types";

export type ReservationEventListener = (payload: ReservationChangedPayload) => void;

/** "connecting" covers both the initial handshake and every automatic retry
 *  after a drop — `EventSource` never truly reaches "closed" on its own
 *  (only `disconnect()` does that), so a consumer only ever needs to
 *  distinguish "live" from "not live right now". */
export type ConnectionStatus = "connecting" | "open" | "closed";
export type StatusListener = (status: ConnectionStatus) => void;

/**
 * A typed wrapper around the browser's native `EventSource`.
 *
 * Deliberately thin. `EventSource` already does the two things that matter
 * most for proposal §12's edge case E-15 (a tablet's Wi-Fi dropping
 * mid-service) entirely on its own, with no code here:
 *
 *   - it reconnects automatically after a drop, with backoff
 *   - it resends whatever `id` it last saw as the `Last-Event-ID` header on
 *     reconnect, which is what lets the server replay anything missed
 *     (see apps/api/src/plugins/realtime.ts's ring buffer)
 *
 * This class exists only to give that reconnecting stream a typed
 * `on`/`off` API and to parse the JSON payload once, in one place, instead
 * of every consumer doing its own `JSON.parse` and hoping the shape matches.
 */
export class RealtimeClient {
  private source: EventSource | null = null;
  private listeners = new Set<ReservationEventListener>();
  private statusListeners = new Set<StatusListener>();

  constructor(private readonly url: string) {}

  connect(): void {
    if (this.source) return;

    this.source = new EventSource(this.url);
    this.emitStatus("connecting");

    this.source.addEventListener("open", () => this.emitStatus("open"));
    // Fires on every drop, including ones the browser is about to retry —
    // there is no separate "still retrying" event, so "connecting" is the
    // right label here too (see the ConnectionStatus doc comment above).
    this.source.addEventListener("error", () => this.emitStatus("connecting"));

    this.source.addEventListener("reservation_changed", (event) => {
      const messageEvent = event as MessageEvent<string>;
      let payload: ReservationChangedPayload;

      try {
        payload = JSON.parse(messageEvent.data);
      } catch {
        // A malformed payload should never take down the whole stream —
        // this event is skipped and the connection stays open for the
        // next one.
        return;
      }

      for (const listener of this.listeners) listener(payload);
    });
  }

  disconnect(): void {
    this.source?.close();
    this.source = null;
    this.emitStatus("closed");
  }

  on(listener: ReservationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private emitStatus(status: ConnectionStatus): void {
    for (const listener of this.statusListeners) listener(status);
  }

  get readyState(): number {
    return this.source?.readyState ?? EventSource.CLOSED;
  }
}
