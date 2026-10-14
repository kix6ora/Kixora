# ADR 0002 — Rate limiting stays per-instance, single Render instance pinned

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

`express-rate-limit` guards `/api/` (100 / 15 min), `/api/auth/` (10 / hour) and
checkout (5 / hour). It uses the default in-memory store, so each Node process
keeps its own counters. With more than one Render instance the effective limit is
`max × instances`: an attacker spreading requests across N instances gets N
budgets, and the limits stop being a reliable control.

## Decision

At the current scale, keep the in-memory store and **pin `numInstances: 1`** on
every service in `render.yaml`. That single-instance assumption is what makes the
in-memory store correct, and it is asserted in the declarative deploy config.

The server logs the active mode at startup so an operator can see it:

    {"message":"[Startup] Rate limiting","store":"memory","instances":"single-required"}

## When this must be revisited

Scaling beyond one instance for availability or throughput. At that point the
store must be shared. Options, in order of preference:

1. **Supabase-backed store** — one row per limiter key, incremented through an
   atomic RPC. No new vendor, but adds a DB write per limited request.
2. **Upstash Redis** — `rate-limit-redis` store. Fast, but a new vendor and a new
   secret; update this ADR first.

Per-instance limits are acceptable only while `numInstances: 1` holds.

## Risk

A restart clears the counters, so a deploy can flush limits. `trust proxy` is
set, so `express-rate-limit` sees the real client IP via `X-Forwarded-For`; this
must not be removed or every client shares one bucket.

## Alternatives considered

- Shared store now (Supabase/Redis): rejected as premature — it adds a network
  dependency and (for Supabase) a DB write on every limited request while the app
  runs on a single instance.
- Do nothing / leave undocumented: rejected — the per-instance limit is a silent
  trap the moment anyone scales out.

## Rollback

Set `numInstances` back to 1 in `render.yaml`, or implement the shared store per
the upgrade path above and update this ADR.

## Consequences

- `render.yaml` carries an explicit `numInstances: 1` with a comment.
- Policies move to `src/server/rateLimit.ts` so they are unit-tested.
- Scaling out without a shared store is a known, documented regression.
