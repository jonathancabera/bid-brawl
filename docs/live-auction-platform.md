# Live Auction Platform — Build & Deployment Guide

> **How to use this guide**: Each phase has two Claude prompts. Use the **Learn prompt** before
> you write any code — it will explain the concept and give you a target to implement against.
> Then write the code yourself. When you're done (or stuck for 30+ minutes), use the
> **Review prompt** to paste your attempt and get feedback. Claude will not write code for you
> unprompted — these prompts are designed to keep you in the driver's seat.
>
> **The rule**: If you haven't attempted it yourself first, you're not ready for the Review prompt.

---

## Project overview

A web-based live auction platform where sellers list items, buyers place real-time bids via
WebSockets, and the winner is charged automatically via Stripe. Deployed on AWS.

**Tech stack**

- Frontend: React + Vite + TypeScript + Tailwind v4
- Backend: Node.js + Express + TypeScript
- Real-time: Socket.io + Redis pub/sub
- Database: PostgreSQL — Supabase (Postgres 17), `pg` pool with SSL required, raw SQL migrations via node-pg-migrate
- Cache / locks: Redis
- File storage: AWS S3
- Payments: Stripe
- Queue: AWS SQS
- Hosting: AWS EC2
- CI/CD: GitHub Actions
- Observability: AWS CloudWatch

---

## Phase 1 — Project setup + auth

**What you're building**: Monorepo structure, Express server, PostgreSQL schema, JWT
authentication (register, login, protected routes).

**Estimated time**: 2–3 days

---

### Learn prompt

```
I'm learning to build a web-based live auction platform. Before I write any code, I want to
understand the foundations.

Please explain the following concepts without writing any implementation code:

1. How should I structure a monorepo with a React frontend and a Node.js/Express backend?
   What goes in each folder and why?

2. What tables does a PostgreSQL schema need for an auction platform — users, auctions, bids,
   payments — and what are the key columns and relationships between them?

3. How does JWT authentication work end to end? Walk me through the register and login flow,
   what a JWT contains, and how a protected route verifies it.

4. What is the purpose of bcrypt in an auth system? Why do we hash passwords instead of
   encrypting them?

After explaining each concept, give me the function signatures and route contracts I should
implement — but not the implementations themselves. I want to write the code myself.
```

---

### Review prompt

```
I'm building a web-based live auction platform. I've attempted to implement project setup
and JWT authentication myself. Here is my code:

[paste your code here]

Please review it and tell me:
1. What is functionally wrong or missing?
2. What security issues do you see?
3. What would break in production that works locally?
4. What would you do differently and why?

Do not rewrite the code for me. Point out the issues and explain the concept behind each
fix — I'll make the changes myself.
```

### Checklist

- [x] Monorepo structure created (`/client`, `/server`)
- [x] PostgreSQL schema with `users`, `auctions`, `bids`, `payments` tables — hosted on Supabase (Postgres 17), loaded and verified; SSL required on the pg pool
- [x] `POST /api/auth/register` works — bcrypt hashing, parameterized insert, duplicate-email → 409, returns JWT + user object
- [x] `POST /api/auth/login` returns a JWT
- [x] Auth middleware (`requireAuth`) protects routes — verifies JWT signature, attaches `req.user`; verified end-to-end against `GET /api/auth/me` (valid → 200, missing/tampered/wrong-scheme → 401)
- [x] `.env.example` committed, `.env` gitignored (`.env` lives in `server/`)

---

## Phase 2 — Auction + listing CRUD

**What you're building**: Sellers can create auctions with images, set start/end times and
reserve prices. Buyers can browse and view listings.

**Estimated time**: 2–3 days

---

### Learn prompt

```
I'm building a web-based live auction platform with Node.js/Express and React.
Auth is working. Now I'm building auction listings with image uploads to AWS S3.

Before I write any code, explain:

1. What REST routes does an auction resource need? Walk me through each route's
   responsibility, what it should validate, and what it should return. Don't write
   the route handlers — just explain the contract.

2. How does image uploading to S3 work from a browser? Explain the two main approaches
   (direct upload via presigned URL vs. server-side upload via multer) and the tradeoffs
   between them.

3. How should I structure the React pages for this feature — AuctionList, AuctionDetail,
   and CreateAuction? What state does each page need to manage?

4. How does a countdown timer work in React for an auction end time? What hook would I
   use and why?

Give me the interface I need to implement — route signatures, component props, data shapes —
but not the implementations. I'll write the code myself.
```

---

### Review prompt

```
I'm building an auction listing system for a web-based live auction platform. I've written
my auction routes and React pages myself. Here is my code:

[paste your code here]

Please review it and tell me:
1. What is functionally wrong or missing?
2. Are there any N+1 query problems or inefficient database calls?
3. Is my S3 upload logic secure? What could go wrong?
4. What edge cases am I not handling (auction already ended, no image uploaded, etc.)?

Point out issues and explain the concept behind each — don't rewrite the code for me.
```

### Checklist

- [x] Auction CRUD routes working — create, list (cursor pagination), detail (with highest bid), update, soft-delete, and `POST /:id/publish` (draft→active). Design: **biddable-now** (`active` = live immediately, `start_time` is display metadata)
- [ ] Image upload to S3 working — deferred, pending other decisions
- [x] Auction list page renders — cursor pagination, load-more with in-flight guard + inline error, loading/error/empty states
- [x] Auction detail page shows current highest bid — id-keyed fetch with cancellation flag, loading/error/not-found states
- [x] Countdown timer showing time remaining — `AuctionTimeCountdown` (self-correcting interval + cleanup, `Intl.DurationFormat`), reused on list card and detail
- [x] CreateAuction form — login flow + create→publish with retry-publish guard, `datetime-local`→ISO, thin client validation. First authed client write. Verified end-to-end.

---

## Phase 3 — Bidding engine

**What you're building**: The core mechanic. Users place bids, the system validates them
atomically using Redis locks, and bid history is recorded.

**Estimated time**: 3–4 days

---

### Learn prompt

```
I'm building the bidding engine for a web-based live auction platform. This is the most
critical part of the system. Before I write any code, I need to deeply understand it.

Please explain the following without writing any implementation:

1. What is a race condition in the context of auction bidding? Walk me through a specific
   scenario where two users bid simultaneously and something goes wrong without locking.

2. What is a distributed lock? How does Redis implement one using SET NX EX? Why does the
   TTL matter, and what happens if the server crashes while holding the lock?

3. Walk me through the exact sequence of steps my bid route should follow — from receiving
   the request to sending the response — including where the lock is acquired and released.

4. What validations must happen before a bid is accepted? Think about: auction state,
   bid amount, the bidder's identity, and timing.

5. What should happen to the lock if bid validation fails? What about if the database
   write fails?

After explaining, give me the function signatures I need to implement. No code.
```

---

### Review prompt

```
I'm building the bidding engine for a web-based live auction platform. I've written the
bid route and Redis locking logic myself. Here is my code:

[paste your code here]

Please review it and tell me:
1. Is my Redis locking pattern correct? Could two bids still get through simultaneously?
2. Am I releasing the lock in all code paths — including error paths?
3. What happens if Redis is down? Does my app crash or degrade gracefully?
4. Are there any database transaction issues — could I record a bid without updating
   the current price, or vice versa?
5. What would break at 100 concurrent bids per second?

Explain the issues — don't rewrite the code.
```

### Checklist

- [x] `POST /api/auctions/:id/bids` validates and records bids — one `SELECT … FOR UPDATE` transaction (bid insert + `current_price` update)
- [x] Redis lock prevents duplicate winning bids — `SET NX PX` fronts the DB transaction; verified by a 20-way concurrency test (exactly one winner)
- [x] Bid history endpoint works — `GET /api/auctions/:id/bids`
- [x] BidForm submits and shows errors (bid too low, auction ended, etc.)
- [x] Lock is released in all code paths including failures — compare-and-delete Lua in `finally`, TTL as the crash backstop

---

## Phase 4 — WebSockets (real-time)

**What you're building**: Live bid updates broadcast to all users watching an auction.
Uses Socket.io with Redis pub/sub so it scales across multiple server instances.

**Estimated time**: 2–3 days

---

### Learn prompt

```
I'm adding real-time bid broadcasting to a web-based live auction platform using Socket.io.
Before I write any code, explain:

1. What is the difference between HTTP and WebSockets? Why can't I just poll the server
   every second for new bids?

2. How do Socket.io rooms work? Walk me through what happens when a user opens an auction
   page and joins a room, and what happens when a bid is placed.

3. Why does a WebSocket server become a problem when you run multiple instances? What
   specifically breaks if two users are connected to different server instances?

4. How does the Redis pub/sub adapter solve the multi-instance problem? Trace the path
   of a bid event from the moment it's placed to the moment every viewer sees the
   price update.

5. How should I handle a user losing their WebSocket connection mid-auction and
   reconnecting? What state might they have missed?

Give me the event names, payloads, and Socket.io method signatures I need to implement.
No code.
```

---

### Review prompt

```
I've implemented WebSocket real-time broadcasting for my live auction platform using
Socket.io and Redis pub/sub. Here is my code:

[paste your code here]

Please review it and tell me:
1. Is my Redis adapter set up correctly for multi-instance broadcasting?
2. Am I cleaning up socket connections and room memberships properly?
3. What happens if a user places a bid and then immediately disconnects — do they
   still see the confirmation?
4. How does my implementation handle a reconnecting user who missed several bids?
5. Could a malicious user join an auction room they shouldn't have access to?

Explain the issues — don't rewrite the code.
```

### Checklist

- [x] Socket.io server running — `src/io.ts` singleton, `http.createServer` split in `index.ts` so `app.ts` (and the supertest harness) stay untouched
- [x] Redis adapter attached (for multi-instance scale) — optional on `REDIS_URL`, mirroring the lock; verified via `pubsub channels`
- [x] Users auto-join the auction room on page load — `auction:join` from `useAuctionSocket`
- [x] Bid submitted → all viewers see price update in under 1 second — measured **52ms** end-to-end
- [x] `auction_closed` event fires when timer hits zero — interval sweeper, single atomic `UPDATE … RETURNING`
- [x] Reconnection handled gracefully — refetch on every re-connect; implemented, not drop-tested in a browser

---

## Phase 5 — Payments (Stripe)

**What you're building**: When an auction closes, charge the winner's card and payout
the seller. Handle Stripe webhooks for async payment confirmation.

**Estimated time**: 2–3 days

---

### Learn prompt

```
I'm integrating Stripe payments into a web-based live auction platform. Before I write
any code, explain:

1. What is the difference between a PaymentIntent and a SetupIntent in Stripe? Which
   one do I use to save a card for later, and which do I use to charge it?

2. Walk me through the full payment flow for my auction platform: a user saves their
   card before bidding, they win an auction, and their card gets charged automatically
   when the auction closes. What Stripe objects are involved at each step?

3. What are Stripe webhooks and why do I need them? Why can't I just trust the response
   from the charge API call?

4. What is idempotency in the context of payments? What happens if my webhook handler
   is called twice for the same payment event, and how do I prevent charging a winner
   twice?

5. How does a Stripe Connect payout to a seller work? What does the seller need to set
   up on their end?

Give me the Stripe API methods I'll need to call and the webhook events I need to handle.
No implementation code.
```

---

### Review prompt

```
I've implemented Stripe payments for my live auction platform. Here is my code:

[paste your code here]

Please review it and tell me:
1. Am I verifying the Stripe webhook signature? What happens if I skip this?
2. Is my webhook handler idempotent — what happens if it's called twice for the same
   event?
3. Am I handling payment failures gracefully? What does the user experience look like
   when a charge fails?
4. Are there any PCI compliance issues with how I'm handling card data?
5. What happens if the auction close worker fires but the winner has no saved payment
   method?

Explain the issues — don't rewrite the code.
```

### Checklist

- [ ] Users can save a card via Stripe Elements
- [ ] Winner is charged automatically when auction closes
- [ ] Stripe webhook receives `payment_intent.succeeded`
- [ ] Payments table records the transaction
- [ ] Seller payout initiated after successful payment
- [ ] Failed payment triggers notification
- [ ] Webhook handler is idempotent

---

## Phase 6 — SQS + workers

**What you're building**: An event queue decouples bid recording from side effects.
Workers handle closing auctions, triggering payments, sending notifications.

**Estimated time**: 2 days

---

### Learn prompt

```
I'm adding an AWS SQS message queue and background workers to my live auction platform.
Before I write any code, explain:

1. What problem does a message queue solve in my system? Why not just call the payment
   service and notification service directly from the bid route?

2. How does SQS long-polling work? What is the difference between standard and FIFO
   queues, and which should I use for auction events?

3. Walk me through the lifecycle of a message: published, received by a worker, processed,
   and deleted. What happens if the worker crashes before deleting the message?

4. What events should flow through my queue? For each event (bid.placed, auction.closed,
   payment.completed, outbid.alert), tell me which service publishes it and which
   worker consumes it.

5. How should my auction close worker know when an auction has ended? Should it use a
   cron job, SQS delay queues, or something else?

Give me the message schemas and worker responsibilities I need to implement. No code.
```

---

### Review prompt

```
I've implemented SQS message queuing and background workers for my live auction platform.
Here is my code:

[paste your code here]

Please review it and tell me:
1. Am I deleting messages from the queue after processing? What happens if I don't?
2. What happens if a worker throws an error halfway through processing — does the
   message get retried? How many times?
3. Is my auction close worker handling the case where two instances try to close the
   same auction simultaneously?
4. Am I handling SQS visibility timeouts correctly? What happens if processing takes
   longer than the timeout?
5. What happens to messages if my queue consumer crashes and stays down for an hour?

Explain the issues — don't rewrite the code.
```

### Checklist

- [ ] SQS queue created and configured
- [ ] All four event types published from the correct places
- [ ] Auction close worker runs on schedule and closes expired auctions
- [ ] Payment worker charges winner after close
- [ ] Notification worker sends outbid and winner emails
- [ ] Workers delete messages after successful processing
- [ ] Failed messages go to a dead letter queue

---

## Phase 7 — AWS deployment

**What you're building**: Production deployment on AWS. EC2 for the server, RDS for
PostgreSQL, ElastiCache for Redis, S3 for files, CloudWatch for logs.

**Estimated time**: 2–3 days

---

### Learn prompt

```
I'm deploying a Node.js/Express + React web app to AWS for the first time. Before I
configure anything, explain:

1. Walk me through the AWS services I need: EC2, RDS, ElastiCache, S3, ALB, ACM.
   What does each one do and why do I need it specifically for this auction platform?

2. What is a VPC, and why should my RDS and ElastiCache instances be in a private
   subnet while my EC2 is in a public subnet?

3. How do security groups work? What rules do I need for:
   - EC2 (web traffic in, SSH in)
   - RDS (only accept connections from EC2)
   - ElastiCache (only accept connections from EC2)

4. What is an IAM instance role and why is it safer than putting AWS credentials
   in my .env file on EC2?

5. How does Nginx work as a reverse proxy in front of my Express server? Why do I
   need it instead of exposing Express directly on port 80?

6. How does PM2 help me run multiple Node.js processes (server + workers) and keep
   them alive if they crash?

Don't give me configs or commands yet. I want to understand the architecture first,
then I'll ask specific questions as I set each service up.
```

---

### Review prompt — use once per service as you set it up

```
I'm setting up [EC2 / RDS / ElastiCache / S3 / IAM — pick one] for my live auction
platform. Here is what I've configured:

[describe your configuration or paste relevant config files]

Please review it and tell me:
1. Are there any security issues with this configuration?
2. Is anything misconfigured that will prevent my app from connecting to this service?
3. What would I regret about this configuration at production scale?
4. What monitoring or alerting should I set up for this service?

Explain the issues — don't reconfigure it for me.
```

### Checklist

- [ ] EC2 instance running, accessible via SSH
- [ ] Nginx serving frontend and proxying API + WebSockets
- [ ] RDS PostgreSQL accessible from EC2 only
- [ ] ElastiCache Redis accessible from EC2 only
- [ ] S3 bucket created with correct permissions
- [ ] IAM instance role attached (no hardcoded AWS credentials)
- [ ] SSL certificate attached via ALB
- [ ] App accessible at your domain over HTTPS
- [ ] PM2 running server + all workers with auto-restart

---

## Phase 8 — CI/CD pipeline

**What you're building**: Automated deploy on every push to `main`. GitHub Actions
builds the frontend, runs tests, and deploys to EC2.

**Estimated time**: 1 day

---

### Learn prompt

```
I'm setting up a CI/CD pipeline with GitHub Actions for my live auction platform.
Before I write any config, explain:

1. What is the difference between CI (continuous integration) and CD (continuous
   deployment)? What does each step actually do in my pipeline?

2. Walk me through the sequence of steps my pipeline needs: from a push to main
   all the way to the new code running on EC2.

3. How do I securely give GitHub Actions access to my EC2 instance? What credentials
   are involved and where are they stored?

4. How does rsync work for copying files to EC2, and why is it better than scp for
   deploying a web app?

5. How do I run database migrations automatically as part of the deploy without
   taking the site down?

Give me the jobs and steps my workflow file needs. I'll write the YAML myself.
```

---

### Review prompt

```
I've written a GitHub Actions deployment workflow for my live auction platform.
Here is my workflow file:

[paste your workflow YAML here]

Please review it and tell me:
1. Are any secrets exposed or handled insecurely?
2. What happens if the rsync succeeds but PM2 reload fails — is my app in a broken state?
3. Am I running migrations safely? Could this cause downtime?
4. What happens if a test fails — does the deploy still run?
5. What's missing that would make this pipeline production-grade?

Explain the issues — don't rewrite the workflow for me.
```

### Checklist

- [ ] `.github/workflows/deploy.yml` written by hand
- [ ] Push to `main` triggers automated deploy
- [ ] Tests run before deploy — failed tests block the deploy
- [ ] Frontend built and synced to EC2
- [ ] PM2 reloaded after deploy
- [ ] Database migrations run automatically
- [ ] No secrets hardcoded in the workflow file

---

## Phase 9 — Polish + demo prep

**What you're building**: README with architecture diagram, and the talking points
that will get you the offer.

**Estimated time**: 1–2 days

---

### Learn prompt — architecture documentation

```
I've finished building and deploying a web-based live auction platform. Help me document
it, but don't write the documentation for me.

Tell me:
1. What sections should a strong engineering portfolio README include, and what makes
   each section compelling to an engineering hiring manager?

2. What should I highlight differently for a fintech company like JPMC vs a marketplace
   startup like WhatNot?

3. What are the "future improvements" I should list that signal senior-level thinking
   without making the current project look incomplete?

I'll write the README myself based on your guidance.
```

---

### Learn prompt — interview prep

```
I built a web-based live auction platform to prepare for software engineering interviews
at JPMC and WhatNot. Help me prepare to talk about it — but don't write my answers for me.

For each of these interview questions, tell me what a strong answer covers and what
most candidates miss. I'll write my own answers afterward.

1. "Walk me through your architecture."
2. "How do you prevent two users from winning the same auction?"
3. "What would break first at 10x scale and how would you fix it?"
4. "What would you do differently if you rebuilt this?"
5. "How does the payment flow work end to end?"

After I write my answers, I'll share them with you for feedback.
```

---

### Review prompt — interview answers

```
I built a live auction platform and I'm preparing for engineering interviews. I've written
my own answers to common interview questions about the project. Here they are:

[paste your answers here]

Please review them and tell me:
1. What important technical details am I glossing over?
2. Where do my answers sound vague or like I don't fully understand what I built?
3. What follow-up questions would an interviewer at JPMC ask after each answer?
4. What follow-up questions would an interviewer at WhatNot ask?
5. Which answer is weakest and why?

Don't rewrite my answers — tell me what to think harder about.
```

### Checklist

- [ ] README written by hand and pushed to GitHub
- [ ] Architecture diagram included
- [ ] Local setup instructions tested by someone else running it cold
- [ ] All 5 interview questions answered in writing
- [ ] Answers reviewed and gaps addressed
- [ ] Demo rehearsed at least 3 times end to end without notes

---

## Quick reference

### The rule for every phase

```
1. Read the Learn prompt response fully before touching your editor
2. Attempt the implementation yourself
3. Spend at least 30 minutes debugging before asking for help
4. Paste your attempt into the Review prompt — not a blank slate
```

If you find yourself copying code from a tutorial or Stack Overflow, that's fine — but
make sure you can delete it and rewrite it from memory before moving on.

---

### Key concepts to explain cold in an interview

| Concept                    | Phase | The one thing to nail                                                 |
| -------------------------- | ----- | --------------------------------------------------------------------- |
| JWT validation             | 1     | What's in the token and how the signature prevents tampering          |
| S3 presigned URLs          | 2     | Why the browser uploads directly to S3 instead of through your server |
| Redis distributed lock     | 3     | What SET NX EX does atomically and why TTL matters                    |
| Socket.io rooms            | 4     | How Redis adapter lets two EC2 instances share events                 |
| Stripe webhook idempotency | 5     | Why you check if payment is already processed before charging         |
| SQS visibility timeout     | 6     | What happens to a message if your worker crashes mid-processing       |
| Private subnet             | 7     | Why RDS has no public IP and why that matters                         |
| Zero-downtime deploy       | 8     | How PM2 reload differs from PM2 restart                               |

---

### AWS services used

| Service                    | Purpose                            |
| -------------------------- | ---------------------------------- |
| EC2 t3.small               | App server + workers               |
| RDS db.t3.micro            | PostgreSQL (source of truth)       |
| ElastiCache cache.t3.micro | Redis (locks + pub/sub)            |
| S3                         | Item images, payment receipts      |
| SQS                        | Async event queue                  |
| ALB                        | HTTPS termination + load balancing |
| ACM                        | Free SSL certificate               |
| CloudWatch                 | Logs and metrics                   |

> **Cost**: ~$60–90/month. Stop EC2 and RDS when not actively demoing.

---

### Useful commands to memorize

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@your-ec2-ip

# Check all running processes
pm2 list

# Tail a specific process log
pm2 logs server
pm2 logs auction-close-worker

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Connect to RDS from EC2
psql -h your-rds-endpoint -U postgres -d auction_db

# Tail CloudWatch logs
aws logs tail /auction-platform/server --follow
```
