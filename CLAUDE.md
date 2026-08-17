# Live Auction Platform

Full spec: docs/live-auction-platform.md

## Stack

- Frontend: React + Vite + TypeScript + Tailwind v4
- Backend: Node.js + Express + TypeScript
- DB: PostgreSQL (pg pool, raw SQL migrations via node-pg-migrate)
- Real-time: Socket.io + Redis pub/sub
- Payments: Stripe
- Queue: AWS SQS
- Hosting: AWS EC2

## Current phase

Phase 2 cleanup — S3 image upload (deferred item). Phases 1–4 otherwise complete; Phase 5 (Stripe) up next.
