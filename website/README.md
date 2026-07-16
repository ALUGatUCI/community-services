# Community Services Website

This folder contains the Next.js website that enables interaction and management
of containers. It is a rewrite of the original static HTML/JS site (see
`old-repo/website/`) using the Next.js App Router.

## Structure

The app lives in `src/`:

- `app/page.tsx` — Login (email + emailed code)
- `app/request/` — Anonymous VPS request form (UCI email + reason)
- `app/api/requests/route.ts` — Route handler that inserts requests into Supabase
- `app/api/auth/*` — Email-code login: `request-code`, `verify-code`, `me`, `logout`
- `app/admin/` — Admin page: log in, view pending requests, approve/reject
- `app/api/admin/*` — Admin endpoints: `login`, `logout`, `me`, `requests`, `approve`, `reject`
- `app/dashboard/` — VPS management (status, start/stop/reboot, port forwarding)
- `app/not-found.tsx` — 404 page
- `lib/api.ts` — Typed wrappers around the HTTP API (client)
- `lib/auth.ts` — Client session-validation and redirect flow (login + dashboard)
- `lib/requests.ts` — Request validation shared by the form and the route handler
- `lib/supabaseServer.ts` — Server-only Supabase client (service-role key)
- `lib/session.ts` — Signed httponly session cookie (jose)
- `lib/loginCodes.ts` — Issue/verify hashed login codes
- `lib/email.ts` — SMTP sender (nodemailer)
- `lib/containerApi.ts` — Server-to-server client for the container-api
- `lib/admin.ts` — Shared-secret admin auth

Each page route is a small Server Component (for the page `<title>`) that
renders a Client Component holding the interactive UI.

## Requests (Supabase)

Requesting a VPS no longer requires an account. The `/request` page collects a
`uci.edu` email and a reason, and posts to the `/api/requests` route handler,
which validates the input and inserts a row into the Supabase `requests` table
using the service-role key (server-side only). Duplicate emails are rejected
(the `email` column is `UNIQUE`).

Configure Supabase via environment variables (see `src/.env.local.example`):

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The `requests` table schema:

| column      | type          | notes                          |
| ----------- | ------------- | ------------------------------ |
| id          | int8          | primary key, identity          |
| created_at  | timestamptz   | not null                       |
| email       | text          | unique, not null               |
| reason      | text          | nullable                       |

## Accounts, login, and approval

Accounts are created when an admin approves a request. Login is passwordless:
the user enters their email, receives a code, and enters it to start a session.

### Login (email code)

1. `POST /api/auth/request-code` `{ email }` — if an account exists, a 6-digit
   code (valid 10 minutes) is hashed into `login_codes` and emailed. The
   response is generic to avoid revealing whether an account exists.
2. `POST /api/auth/verify-code` `{ email, code }` — on success, issues a signed
   httponly `session` cookie (JWT, 1-day TTL).
3. `GET /api/auth/me` — returns the current session (used to gate the dashboard).
4. `POST /api/auth/logout` — clears the session cookie.

### Admin page

`/admin` is the admin console. Admins log in with the shared secret
(`ADMIN_API_KEY`) via `POST /api/admin/login`, which verifies it and sets a
short-lived (4h) signed httponly `admin_session` cookie; the page then lists
pending requests and offers Approve / Reject per request.

The page has three tabs: **Requests** (approve/reject), **Accounts**
(suspend/unsuspend/delete), and **Nodes** (manage the `nodes` table). Admin
endpoints are authorized by **either** a valid `admin_session` cookie **or** the
`x-admin-key` header (so scripts can still call them directly):

- `POST /api/admin/login` `{ secret }` → sets the admin cookie
- `POST /api/admin/logout` → clears it
- `GET /api/admin/me` → whether the caller is an admin
- `GET /api/admin/requests` → pending requests (oldest first)
- `POST /api/admin/approve` `{ request_id? | email? }` → provision + create account
- `POST /api/admin/reject` `{ request_id? | email? }` → email applicant + delete request
- `GET /api/admin/nodes` → list nodes (address + whether a key is set; keys are
  never returned)
- `POST /api/admin/nodes` `{ address, secret_key? }` → add a node
- `PATCH /api/admin/nodes` `{ address, secret_key }` → set/rotate/clear a node's key
- `DELETE /api/admin/nodes?address=…` → delete a node (blocked if accounts still
  reference it)
- `POST /api/admin/nodes/test` `{ address }` → check reachability/key and capacity
- `GET /api/admin/accounts` → list accounts (email, node, banned, created)
- `POST /api/admin/suspend` `{ email }` → ban (blocks login) + freeze the container
- `POST /api/admin/unsuspend` `{ email }` → unban (re-enable login) + unfreeze
- `DELETE /api/admin/accounts?email=…` → delete the account and its container

**Suspension** sets `accounts.banned = true`: login is refused (no code is sent,
and any existing session is rejected by `/api/auth/me` and the container proxy),
and the container is frozen. Unsuspend reverses both.

### Approval

`POST /api/admin/approve` — admin-only (see above). Body: `{ request_id? |
email? }` (identify the request by id or email). It:

1. Looks up the pending request; 409s early if an account already exists.
2. Walks the `nodes` table in order, calling each node's `GET /api/at_limit`
   (authenticated with that node's `secret_key`). It skips nodes that lack a
   key, are unreachable, or are at capacity, and provisions on the first one
   that accepts the container (`POST /api/create`, with a generated temporary
   SSH password). If a node fills between the check and create (503), it moves
   on to the next. 503 if no node has capacity.
3. Inserts the `accounts` row (`container_ip` = the chosen node's address). If
   this fails, the freshly created container is torn back down.
4. Deletes the request and emails the user their temporary password.

Each node's container-api is reached at
`<CONTAINER_API_SCHEME>://<nodes.address>:<CONTAINER_API_PORT>` (default
`http://<address>:8000`) and authenticated with that node's `secret_key` from
the `nodes` table (sent as the `X-API-Key` header).

### Supabase schema

`accounts`:

| column       | type        | notes                              |
| ------------ | ----------- | ---------------------------------- |
| id           | int8        | primary key, identity              |
| created_at   | timestamptz | not null                           |
| email        | text        | unique, not null                   |
| container_ip | text        | not null, FK → `nodes.address`     |
| banned       | bool        | not null, default false            |

`nodes`:

| column     | type | notes                                      |
| ---------- | ---- | ------------------------------------------ |
| address    | text | primary key                                |
| secret_key | text | that node's container-api INTERNAL_API_KEY |

`login_codes` (create this table):

```sql
create table if not exists login_codes (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email      text not null,
  code_hash  text not null,
  expires_at timestamptz not null
);
create index if not exists login_codes_email_idx on login_codes (email);
```

### Configuration

See `src/.env.local.example` for all variables: `SUPABASE_*`, `SESSION_SECRET`,
`ADMIN_API_KEY`, `CONTAINER_API_SCHEME` / `CONTAINER_API_PORT`, and `SMTP_*`.
Per-node container-api keys live in the `nodes.secret_key` column, not in env.
Note each node's container-api enforces an IP allowlist (`ALLOWED_IP`), so nodes
must permit requests from wherever this app runs.

## Backend (container management)

The dashboard and login talk to the FastAPI backend through same-origin
relative paths (`/token`, `/accounts/*`, `/containers/*`). In development these
are proxied via `rewrites` in `next.config.ts`. The target defaults to
`http://127.0.0.1:8000`; override it with the `BACKEND_URL` environment variable:

```bash
BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

In production, serve the frontend behind a reverse proxy that routes those same
paths to the backend.

## Development

From `src/`:

```bash
npm install
npm run dev     # start the dev server
npm run build   # production build
npm run lint    # ESLint (next build no longer lints in Next.js 16)
```
