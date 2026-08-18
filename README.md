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
- **Direct-to-S3 image uploads** — the browser `PUT`s straight to S3 using a 60-second presigned
  URL, so image bytes never pass through the API. The bucket blocks all public access and is
  readable only through CloudFront via an origin access control; because keys are UUIDs and objects
  are never overwritten, cached images can't go stale and no invalidation is ever needed.
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
| Storage    | AWS S3 (presigned uploads) + CloudFront   |
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
- **Image uploads** — `POST /api/uploads/presign` issues a short-lived presigned `PUT` restricted
  to JPEG/PNG. Objects land under `uploads/{user_id}/{uuid}` and are served back from CloudFront.

## Roadmap

- Payments (Stripe) and automatic winner charging
- Background workers (SQS) for auction close and notifications
- AWS deployment (EC2 / RDS / ElastiCache) + CI/CD

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
- **Upload size is unbounded.** The presigned `PUT` pins the content type but not the content
  length, so a caller holding a valid URL can push an arbitrarily large object. Fixing it properly
  means a presigned POST with a `content-length-range` condition.
- **No payments.** The app itself runs locally; the S3 + CloudFront image path is the only piece
  backed by real AWS infrastructure.
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

# Image uploads — see "Image uploads (optional)" below
AWS_REGION=us-east-2
S3_BUCKET=your-bucket-name
CLOUDFRONT_DOMAIN=xxxxxxxxxxxxxx.cloudfront.net
AWS_ACCESS_KEY_ID=change_me
AWS_SECRET_ACCESS_KEY=change_me

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

### 5. (Optional) Image uploads

Everything else runs without this; leave the AWS variables unset and `POST /api/uploads/presign`
returns a 500 while the rest of the app works normally. To enable uploads you need:

- An **S3 bucket** with Block Public Access fully on and default encryption (SSE-S3).
- A **CORS rule** on that bucket allowing `PUT` from your frontend origin
  (`http://localhost:5173` in dev) with `content-type` in `AllowedHeaders` — without it the
  browser blocks the upload before S3 ever sees it.
- A **CloudFront distribution** in front of the bucket using an origin access control, which is
  what makes objects readable. Direct `*.s3.*.amazonaws.com` URLs return 403 by design.
- An **IAM user** whose policy grants only `s3:PutObject` on `arn:aws:s3:::<bucket>/uploads/*`.

`AWS_REGION` must match the bucket's region — signing for the wrong one fails the presigned `PUT`
with `SignatureDoesNotMatch`, which doesn't mention the region anywhere.

### 6. Run the app

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
