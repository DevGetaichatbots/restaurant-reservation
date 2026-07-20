# Restaurant Reservation Platform

One backend, one database, three purpose-built web interfaces — and no
third-party booking subscription.

A guest reserves a table from the restaurant's Google listing. The booking
appears on the owner's dashboard and the floor staff's tablet within a second,
without anyone pressing refresh.

**Setup instructions: [`docs/SETUP.md`](docs/SETUP.md)**

---

## Layout

```
apps/
  api/          Fastify backend — REST + SSE. The only place rules are enforced.
  booking/      Next.js — the public guest booking page
  admin/        React + Vite — the owner's dashboard
  staff/        React + Vite + PWA — the in-restaurant tablet

packages/
  db/           Drizzle schema, migrations, seed data
  contracts/    Zod schemas — request/response shapes
  rules/        Booking rules as pure, testable functions
  api-client/   Typed client generated from the OpenAPI spec
  realtime/     SSE client hook, reconnect, cache invalidation
  ui/           Design tokens and shared components
```

### Why one repository

`packages/contracts` defines the shape of a booking exactly once. The API
validates against it, and all three front-ends validate their forms against the
same definition. Change it and TypeScript reports the mismatch in every app that
disagrees — at compile time, not in a browser.

In four separate repositories that shared code would have to be published as a
package and version-bumped in three places for every change. They would drift.
Here they cannot.

---

## Inside the API

```
apps/api/src/
  server.ts              entry point, graceful shutdown
  app.ts                 builds Fastify; auto-loads everything below
  config/env.ts          all environment variables, validated once at boot
  plugins/               cross-cutting: db, cors, rate-limit, swagger, errors
  modules/               one folder per feature
    health/
    tables/
    reservations/
    availability/
    requests/
    settings/
    realtime/
  lib/                   errors, helpers
```

Routes are not registered by hand. `app.ts` scans `plugins/` and then
`modules/`, mounting any `*.routes.ts` file under a prefix taken from its folder
name. **Adding a feature means creating a folder — never editing the wiring.**

That is what keeps the structure readable as the API grows past a few dozen
routes, and it is why `app.ts` will look much the same in week 12 as it does
now.

---

## Two design decisions worth knowing before reading the code

**Double-booking is prevented by the database, not by application code.**

```sql
EXCLUDE USING gist (table_id WITH =, slot_range WITH &&)
WHERE (table_id IS NOT NULL AND status NOT IN ('cancelled','completed',...))
```

Two guests can submit for the same table in the same millisecond. Postgres
commits one and rejects the other; the loser gets a `409` and a refreshed list
of options. There is no window between checking and writing, because there is
no separate check.

The constraint is *partial* — it applies only once a booking holds a real
table. Requests carry no table yet, so the restaurant can accept guests beyond
its table grid without ever weakening the guarantee.

**Real-time is one-way, so it is served one-way.** Every write goes through the
REST API where validation and rules live. Nothing needs to travel *up* a live
connection, so we use Server-Sent Events over ordinary HTTPS rather than
WebSockets: reconnection is built into the browser, missed events replay via
`Last-Event-ID`, and there is no second protocol to secure. Postgres
`LISTEN/NOTIFY` fans changes out with no extra infrastructure.

---

## Commands

```bash
pnpm install

pnpm db:generate     # schema changed → generate migration
pnpm db:migrate      # apply migrations
pnpm db:seed         # demo data
pnpm db:studio       # browse the database

pnpm api:dev         # http://localhost:4000
pnpm typecheck
pnpm test
```

API documentation is generated from the route schemas and served at `/docs`.

---

## Status

| | |
|---|---|
| ✅ | Monorepo, tooling, CI-ready structure |
| ✅ | API skeleton: config, plugins, error handling, health checks, OpenAPI |
| ✅ | Database package, migration runner, `btree_gist` extension migration |
| ✅ | Schema M1–M2 — enums, restaurant, tables |
| ⬜ | M3–M5 — availability, slots, blocked dates, rules, guests |
| ⬜ | M6 — reservations + the exclusion constraint |
| ⬜ | M7–M8 — audit log, NOTIFY triggers, indexes, seed |
| ⬜ | Rules package, API modules, SSE |
| ⬜ | Front-ends |
