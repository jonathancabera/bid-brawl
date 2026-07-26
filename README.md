# Live Auction Platform

A full-stack live auction platform where sellers list items and buyers place competing bids. The
core of the project is a **concurrency-safe bidding engine** that guarantees exactly one winner per
lot even when many bids arrive at the same instant.

> Portfolio / learning project, built in phases. Auth, auction management, and the bidding engine
> are complete; real-time, payments, and cloud deployment are planned (see [Roadmap](#roadmap)).

## Highlights

- **Concurrency-safe bidding** — each bid runs inside a PostgreSQL `SELECT … FOR UPDATE`
  transaction (bid insert + price update commit atomically), fronted by a Redis distributed lock
  (`SET NX PX`) that sheds contention before it reaches the database. Verified by a 20-way
  concurrent-bid test that asserts a single winner.
- **Keyset (cursor) pagination** for the auction feed — stable under concurrent inserts, no
  row-skipping the way `OFFSET` pagination drifts.
- **Stateless JWT auth** (bcrypt-hashed passwords) and a typed API client with a single error
  boundary.
- **Integration test harness** — Vitest + supertest running against a Dockerized PostgreSQL (and
  Redis), with per-test isolation.

## Tech stack

| Layer      | Tech                                    |
| ---------- | --------------------------------------- |
| Frontend   | React, Vite, TypeScript, Tailwind CSS   |
| Backend    | Node.js, Express, TypeScript            |
| Database   | PostgreSQL (`pg` pool, raw SQL schema)  |
| Cache/lock | Redis (optional in local dev — see below) |
| Testing    | Vitest, supertest, Docker Compose       |

## Project structure

```
client/   React + Vite frontend
server/   Express API, SQL schema, bidding engine, tests
docs/     Working notes and the phase-by-phase build guide
```

## What's built

- **Auth** — register, login, JWT-protected routes (`bcrypt`, `requireAuth` middleware).
- **Auctions** — create, list (cursor pagination), detail, update, soft-delete, and publish
  (draft → active).
- **Bidding** — `POST /api/auctions/:id/bids` with the Redis lock + `FOR UPDATE` transaction,
  plus bid history.

## Roadmap

- Real-time bid updates (Socket.io + Redis pub/sub)
- Payments (Stripe) and automatic winner charging
- Background workers (SQS) for auction close and notifications
- AWS deployment (EC2 / RDS / ElastiCache / S3) + CI/CD

## Constraints & known limitations

This is an in-progress build; a few things are intentionally deferred:

- **No real-time yet.** After you place a bid the price updates on the next page load — live
  push is the next phase.
- **Redis is optional locally.** If `REDIS_URL` is unset, the lock becomes a pass-through and the
  PostgreSQL transaction alone guarantees correctness (it's the source of truth). Set `REDIS_URL`
  to exercise the full lock path.
- **No image uploads.** `item_image` is a plain URL string (S3 upload is deferred).
- **No payments and no deployment** — runs locally only.
- **Minimal styling.** The UI is functional, not yet designed.
- **Validation is manual** (no schema/runtime validation library) and there's no rate limiting —
  fine for local testing, not production-hardened.

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
# REDIS_URL=redis://localhost:6379   # optional; enables the distributed lock
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

## Testing

The backend has an integration suite that runs against a Dockerized PostgreSQL (and Redis), so
**Docker Desktop must be running**:

```bash
cd server
npm run db:test:up      # start the test Postgres + Redis containers
npm test                # run the suite
npm run db:test:down    # stop and remove the containers
```

The suite covers auth, auction CRUD, and the bidding engine — including the 20-way concurrency
test that proves exactly one winner under a simultaneous-bid race.
