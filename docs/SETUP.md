# Setup Guide

Follow these in order. Each part is independent once the one before it is done.

| # | Platform | What it gives us | Cost |
|---|---|---|---|
| 1 | **pgAdmin** (local) | Development database | Free |
| 2 | **GitHub** | Source control, and the trigger for every deploy | Free |
| 3 | **Neon** | Staging Postgres that does not expire | Free |
| 4 | **Render** | API host — the only one of these that supports SSE | Free |
| 5 | **Netlify** | The three front-ends | Free |

---

## 1 · pgAdmin — the local database

Your server is PostgreSQL 18, which is well past the version 14 we need.

### 1.1 Create the database

In pgAdmin's left panel: right-click **Databases** → **Create** → **Database…**

| Field | Value |
|---|---|
| Database | `rms_dev` |
| Owner | `postgres` |
| Encoding | `UTF8` |

Click **Save**.

> Create a separate database rather than reusing `postgres` or sitting alongside
> `pharmaOS`. Migrations, seeding and test resets all wipe and rebuild — you do
> not want that pointed at anything else.

### 1.2 Enable the extension the whole design depends on

Select **`rms_dev`**, open the **Query Tool** (the terminal-style icon), and run:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('btree_gist', 'uuid-ossp');
```

You should get two rows back.

**If `btree_gist` fails to install, stop and tell me.** It is what makes this
possible:

```sql
EXCLUDE USING gist (table_id WITH =, slot_range WITH &&)
```

That single constraint is how two guests can never hold the same table at the
same time. Without the extension we would fall back to application-level locks,
where correctness depends on our code being flawless rather than on the database
being unable to comply.

### 1.3 Confirm the version

```sql
SELECT version();
```

Note the major version — we will match it on Neon so local and staging behave
identically.

### 1.4 Point the project at it

Copy `.env.example` to `.env` and set:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/rms_dev
```

`.env` is gitignored. It must never be committed.

---

## 2 · GitHub — the repository

### 2.1 Revoke the old token first

The token shared in chat is compromised and must be deleted:

**GitHub → Settings → Developer settings → Personal access tokens → Delete**

Nothing below needs a token.

### 2.2 Create an empty repository

**github.com → New repository**

| Field | Value |
|---|---|
| Name | `restaurant-reservation` |
| Visibility | **Private** |
| Initialise with README | **No** — leave every checkbox empty |

Leaving it empty matters: the local repository already has commits, and an
auto-created README would collide with them on the first push.

### 2.3 Push

In the project folder:

```bash
git remote add origin https://github.com/YOUR_USERNAME/restaurant-reservation.git
git branch -M main
git push -u origin main
```

Git will prompt for credentials. Sign in through the browser window it opens —
that way the credential is stored by Windows Credential Manager and never
appears in a file or a chat.

### 2.4 Protect `main`

**Settings → Branches → Add branch protection rule**

- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass

Every deploy below is triggered by a push to `main`. This is what stops a
half-finished change from reaching staging.

---

## 3 · Neon — the staging database

Render's own free Postgres is deleted 30 days after creation. This project runs
13 weeks, so that database would die around week 5. Neon's free tier has no such
expiry.

### 3.1 Create the project

**neon.tech → Sign up with GitHub → Create project**

| Field | Value |
|---|---|
| Project name | `restaurant-reservation` |
| Postgres version | **match your local version** |
| Region | Closest to the restaurant |

### 3.2 Copy the connection string

On the project dashboard, **Connection string** → choose **Pooled connection**.

It looks like:

```
postgresql://user:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

Take the **pooled** one, not the direct one. Pooled survives many short-lived
connections, which is what a web API produces.

Keep it somewhere safe for step 4. **Do not paste it into a file in this
repository.**

### 3.3 Enable the extension here too

Neon dashboard → **SQL Editor**:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Extensions are per-database. Enabling it locally does nothing for Neon.

### 3.4 Watch the compute budget

Free tier includes 100 CU-hours of compute per month, and Neon scales to zero
after five minutes of inactivity.

**Do day-to-day development against your local database.** Neon is only for the
deployed staging environment. Pointing local development at Neon will burn the
monthly budget in about a week.

---

## 4 · Render — the API

Render is here for one reason: it is the only host in this stack that keeps an
HTTP connection open for hours. Netlify closes connections at roughly 30
seconds, which makes SSE impossible there.

### 4.1 Create the service

**render.com → New → Web Service → Connect your GitHub repo**

| Setting | Value |
|---|---|
| Name | `rms-api` |
| Region | Same as Neon |
| Branch | `main` |
| Root Directory | `apps/api` |
| Runtime | **Docker** |
| Dockerfile Path | `apps/api/Dockerfile` |
| Docker Context | `.` *(repository root — the build needs the shared packages)* |
| Instance Type | Free |

Docker rather than Render's own build system on purpose: the same image runs on
AWS Fargate later, so moving hosts becomes an infrastructure change instead of a
rewrite.

### 4.2 Environment variables

**Environment** tab → add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *the pooled Neon string from 3.2* |
| `RESTAURANT_TIMEZONE` | `Asia/Karachi` |
| `LOG_LEVEL` | `info` |
| `CORS_ORIGINS` | *fill in after step 5 — the three Netlify URLs* |

Do not set `PORT`. Render assigns it, and the app already reads it.

### 4.3 Health check

**Settings → Health Check Path**: `/health`

Render polls this to decide whether the service is alive. It is already
implemented and needs no database, so it answers even if Neon is asleep.

### 4.4 Deploy and verify

Deploy runs automatically. When it finishes:

```
https://rms-api.onrender.com/health         → {"status":"ok",...}
https://rms-api.onrender.com/health/ready   → database connectivity
https://rms-api.onrender.com/docs           → API documentation
```

`/health/ready` failing while `/health` passes means the process is up but
cannot reach Neon — check `DATABASE_URL`.

### 4.5 Two free-tier behaviours to expect

**Sleeps after 15 minutes idle.** The next request takes about a minute to wake
it. Annoying, not harmful — and our SSE clients reconnect on their own, which
is a property of the protocol rather than something we had to write. WebSockets
would have needed hand-written reconnection logic to survive this.

**750 instance hours per month** across the workspace. Fine for development.

The consequence: *"does one connection stay alive for eight hours"* cannot be
tested on Render's free tier, because the platform closes it. Test that against
your local server, on a real tablet. Everything else tests fine on Render.

---

## 5 · Netlify — the three front-ends

One repository, three sites. Each site builds a different folder.

Nothing to do here until Sprint 3, but the sites can be created now so the URLs
exist and CORS can be configured once.

### 5.1 Create three sites

For each, **Add new site → Import an existing project → pick the same repo**:

| Site name | Base directory | Build command | Publish directory |
|---|---|---|---|
| `rms-booking` | `apps/booking` | `pnpm build` | `apps/booking/.next` |
| `rms-admin` | `apps/admin` | `pnpm build` | `apps/admin/dist` |
| `rms-staff` | `apps/staff` | `pnpm build` | `apps/staff/dist` |

Yes — the same repository three times. That is how a monorepo deploys, and it
is completely standard.

### 5.2 Stop the three sites rebuilding on every push

Without this, a change to the admin panel rebuilds all three sites and burns
free build minutes.

Each site → **Site settings → Build & deploy → Ignore builds**:

```bash
git diff --quiet HEAD^ HEAD -- apps/admin packages/
```

Change `apps/admin` to match the site. It means *"skip the build if nothing in
these folders changed."* `packages/` stays in every one, because shared code
affects all three.

### 5.3 Environment variable

Each site needs the API address:

```
VITE_API_URL=https://rms-api.onrender.com          # admin, staff
NEXT_PUBLIC_API_URL=https://rms-api.onrender.com   # booking
```

### 5.4 Close the loop on CORS

Back in Render, set `CORS_ORIGINS` to the three Netlify URLs, comma-separated,
no trailing slashes:

```
https://rms-booking.netlify.app,https://rms-admin.netlify.app,https://rms-staff.netlify.app
```

The API rejects any origin not on this list. Miss this and the front-ends get
CORS errors in the browser console with a perfectly healthy API behind them.

### 5.5 Custom domains — later

When the domain is available, each Netlify site takes a subdomain
(`book.`, `admin.`, `staff.`) and Render takes `api.`. Add the real domains to
`CORS_ORIGINS` at that point. No code changes.

---

## Daily development

```bash
pnpm install          # once, and after pulling dependency changes

pnpm db:generate      # schema changed → generate a migration
pnpm db:migrate       # apply migrations to whatever DATABASE_URL points at
pnpm db:seed          # load demo data (Tables 1–7)
pnpm db:studio        # browse the database in a GUI

pnpm api:dev          # API on http://localhost:4000
pnpm typecheck        # type-check every package
pnpm test             # run tests
```

Local `.env` stays pointed at `rms_dev`. Render has its own environment
variables pointing at Neon. The same migrations run against both.

---

## Deployment flow

```
  git push origin main
          │
          ├──→ Render   rebuilds the Docker image → deploys the API
          │
          └──→ Netlify  rebuilds only the sites whose folders changed
```

No manual deploy step, on any platform. That is the point of doing this in
week 1 rather than week 4 — by the time there is something substantial to ship,
shipping is already a solved problem.

---

## Security rules for this repository

1. **No credential in any committed file.** `.env` is gitignored; keep it that way.
2. **No credential in chat, tickets or documents.** Anything pasted into a
   message is compromised from that moment and must be rotated.
3. Secrets live in the platform dashboards — Render's Environment tab,
   Netlify's environment variables.
4. Sign in to GitHub through the browser prompt so Windows Credential Manager
   holds the credential, not a file.
