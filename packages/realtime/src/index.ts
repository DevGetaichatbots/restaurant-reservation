/**
 * The client side of proposal §08's real-time layer.
 *
 * Three layers, each usable independently:
 *   client.ts             a typed EventSource wrapper — framework-agnostic
 *   react.ts               a hook that owns the connection's lifecycle
 *   query-integration.ts   wires it to TanStack Query cache invalidation,
 *                          which is what every app actually calls
 *
 * A front-end module reading reservation data has nothing more to do than
 * call `useLiveReservations(eventsUrl, queryClient)` once near its root and
 * use TanStack Query as normal everywhere else — the cache invalidation
 * happens automatically from then on.
 */

export * from "./types";
export * from "./client";
export * from "./react";
export * from "./query-integration";
