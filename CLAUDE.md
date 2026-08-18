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

Phase 5 — Stripe payments. Phases 1–4 complete, including the deferred S3 image upload; the `payments` table and the `users` Stripe columns exist but are unused.

## Working style

The learn-prompt blocks in the spec are historical — no longer followed. Don't reintroduce that
workflow or point back to those prompts. Current preference:

- **Code review** — review what's already written. Point out issues and explain the concept behind
  each; don't rewrite the code or reconfigure things unless asked.
- **Systems design / big picture** — architecture, tradeoffs, and why one approach over another,
  especially where a design choice stops holding at scale.
- **Syntax questions** occasionally, as they come up.
