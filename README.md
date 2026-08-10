<p align="center">
  <img src="assets/bidbrawl-github-header.jpg" alt="BidBrawl — every auction is a brawl. Only one wins." width="100%">
</p>

# BidBrawl

A full-stack live auction platform where sellers list items and buyers place competing bids in
real time. The core of the project is a **concurrency-safe bidding engine** that guarantees exactly
one winner per lot even when many bids arrive at the same instant.

<p align="center">
  <img src="assets/bidbrawl-features-strip.jpg" alt="Real-time bidding · Live auctions · One winner · Secure and fair" width="100%">
</p>

## Highlights

- **Concurrency-safe bidding** — each bid runs inside a PostgreSQL `SELECT … FOR UPDATE`
  transaction (bid insert + price update commit atomically), fronted by a Redis distributed lock
  (`SET NX PX`) that sheds contention before it reaches the database. Verified by a 20-way
  concurrent-bid test that asserts a single winner.
- **Real-time updates** — Socket.io with a Redis pub/sub adapter so broadcasts survive multiple
  server instances. A bid reaches every viewer of that lot in **~50ms**, measured end-to-end.
- **Atomic auction close** — expired lots are closed by a single `UPDATE … RETURNING`, which
  doubles as the concurrency guard: overlapping sweeps can't double-close or double-emit, because
  events are driven off the rows the statement actually transitioned.
- **Secret reserve prices** — a reserve is the seller's hidden walk-away price, not a bidding
  floor. Bidding opens low to draw competition; a lot whose top bid never clears the reserve closes
  unsold. The figure is never sent to the client.
- **Keyset (cursor) pagination** for the auction feed — stable under concurrent inserts, no
  row-skipping the way `OFFSET` pagination drifts.
- **Stateless JWT auth** (bcrypt-hashed passwords) and a typed API client with a single error
  boundary.
- **Integration test harness** — Vitest + supertest running against a Dockerized PostgreSQL and
  Redis, with per-test isolation.

## Tech stack

| Layer      | Tech                                      |
| ---------- | ----------------------------------------- |
| Frontend   | React, Vite, TypeScript, Tailwind CSS     |
| Backend    | Node.js, Express, TypeScript              |
| Real-time  | Socket.io + Redis adapter                 |
| Database   | PostgreSQL (`pg` pool, raw SQL schema)    |
| Cache/lock | Redis (optional in local dev — see below) |
| Testing    | Vitest, supertest, Docker Compose         |

## Project structure

```
client/   React + Vite frontend
server/   Express API, SQL schema, bidding engine, real-time layer, tests
docs/     Working notes and the phase-by-phase build guide
assets/   Brand assets (header, features strip, social preview, icon)
```

## What's built

- **Auth** — register, login, JWT-protected routes (`bcrypt`, `requireAuth` middleware).
- **Auctions** — create, list (cursor pagination), detail, update, soft-delete, and publish
  (draft → active).
- **Bidding** — `POST /api/auctions/:id/bids` with the Redis lock + `FOR UPDATE` transaction,
  plus bid history.
- **Real-time** — room per auction, live price broadcasts on every accepted bid, and an
  `auction:closed` event when a lot ends. Clients refetch on reconnect, so a dropped connection
  self-heals rather than leaving a stale price on screen.
- **Auction close** — a background sweep closes expired lots, resolves the winner against the
  reserve, and drops them out of the browse feed.

## Roadmap

- Payments (Stripe) and automatic winner charging
- Background workers (SQS) for auction close and notifications
- AWS deployment (EC2 / RDS / ElastiCache / S3) + CI/CD

## Constraints & known limitations

This is an in-progress build; a few things are intentionally deferred:

- **Auction close runs in-process.** A single `setInterval` sweep closes expired lots. The
  `UPDATE` is atomic, so this is already safe across multiple instances — but once closing has to
  charge a card, the side effect lives outside the transaction and needs a real queue. That's the
  Phase 6 work.
- **Redis is optional locally.** If `REDIS_URL` is unset, the lock becomes a pass-through and the
  PostgreSQL transaction alone guarantees correctness (it's the source of truth); the Socket.io
  Redis adapter is skipped and real-time still works on a single instance. Set `REDIS_URL` to
  exercise the full path.
- **No image uploads.** `item_image` is a plain URL string (S3 upload is deferred).
- **No payments and no deployment** — runs locally only.
- **Minimal styling.** The UI is functional, not yet designed.
- **Validation is manual** (no schema/runtime validation library) and there's no rate limiting —
  fine for local testing, not production-hardened.
- **Backend tests only.** The frontend has no test coverage yet.

## Running locally

### Prerequisites

- **Node.js 18+**
- **A PostgreSQL database** — a free [Supabase](https://supabase.com) project works, or a local
  Postgres.
- **(Optional) Docker** — to run Redis and/or the test database.

### 1. Install dependencies

```bash
npm install                      # root (concurrently, prettier)
npm install --prefix server
npm install --prefix client
```

### 2. Configure environment

**`server/.env`** (copy from `server/.env.example`):

```bash
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/auction_db
JWT_SECRET=change_me
# REDIS_URL=redis://localhost:6379   # optional; enables the lock + multi-instance broadcasts
```

**`client/.env`** (copy from `client/.env.example`):

```bash
VITE_API_URL=http://localhost:3000
```

### 3. Load the database schema

```bash
psql "$DATABASE_URL" -f server/src/db/schema.sql
```

### 4. (Optional) Start Redis

```bash
docker run -d --rm -p 6379:6379 redis:7-alpine
# then set REDIS_URL=redis://localhost:6379 in server/.env
```

### 5. Run the app

```bash
npm run dev        # runs server (:3000) and client (:5173) together
```

- API: http://localhost:3000
- Web app: http://localhost:5173

You can also run them separately with `npm run dev:server` and `npm run dev:client`.

To see the real-time layer work, open the same auction in two browser windows and bid in one.

## Testing

The backend has an integration suite that runs against a Dockerized PostgreSQL and Redis, so
**Docker Desktop must be running**:

```bash
cd server
npm run db:test:up      # start the test Postgres + Redis containers
npm test                # run the suite
npm run db:test:down    # stop and remove the containers
```

25 tests covering auth, auction CRUD, the bidding engine, and auction close — including the 20-way
concurrency test that proves exactly one winner under a simultaneous-bid race, and a regression
test asserting the reserve price never reaches the client.
