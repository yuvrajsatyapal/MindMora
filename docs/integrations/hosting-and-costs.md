# Hosting and Free-Tier Budget

**Status:** 📋 Deployment unselected. Historical official-pricing research dated 2026-10-03; not rechecked in this documentation pass. Recheck before integration/deployment. Budget target: approximately 3–4 daily users, no automatic paid upgrades.

## Hosted quotas

- Supabase Free: 500 MB database, 1 GB file storage, 50,000 monthly active users, 5 GB egress and 5 GB cached egress. Free projects may pause after one week of inactivity. Knowledge/history/embeddings and files now consume these quotas. This is not a Neon-style monthly compute-hours promise. [Pricing](https://supabase.com/pricing)
- Upstash Redis Free candidate: 256 MB, 500,000 commands/month, 10 GB monthly bandwidth. Commands include background queue activity, not only user requests. Check current tier/config/security and BullMQ support before adopting. [Pricing](https://upstash.com/pricing/redis), [idle command usage](https://upstash.com/docs/redis/troubleshooting/command_count_increases_unexpectedly)

Do not assume Redis encryption at rest is included on every free tier. Redis holds only counter/job references; validate provider transport/access/persistence guarantees and keep private content out. Canonical PostgreSQL/files/backups require verified encryption-at-rest before sensitive-data readiness.

## Software versus hosting

BullMQ OSS, Pino and Zod are MIT libraries; Drizzle ORM/kit and postgres-js are installed at exact versions recorded in [dependencies](../design/dependencies.md); broader OpenAPI/Swagger tooling is unselected. Nginx OSS software is free. Next/worker/Nginx server resources, disks, logs, bandwidth, certificates/domain and backups have separate hosting/operational requirements. Postman uses its available free local/collection features, not assumed unlimited cloud collaboration.

Runtime Next.js and a separately running worker need explicit hosting. Static-only hosting cannot satisfy these requirements. Managed ingress may remove the need for custom Nginx. No particular host, always-on free worker, no-card deployment or uptime guarantee is selected. Do not use keep-alive traffic to disguise a provider's sleep policy.

## Budget controls to implement

Bound pages/query frequency and pool size; debounce edits appropriately with revision checks; cap uploads and exports; delete staged/expired objects and old histories/job results/logs; retry with backoff; set worker concurrency and retention; monitor actual commands/DB/egress rather than user count alone. Avoid model download/embedding churn and full reindex on every startup. Redis queue polling can exhaust quotas while users are idle.

Choose a deployment plan only after checking current terms, quota fit, payment/credit-card needs, pause/cold-start behavior, TCP networking and restore guarantees. If no free service fits a required continuously running worker, report the constraint and propose a reviewable alternative; do not silently add a paid resource or claim the agreed topology costs nothing indefinitely.

## Current evidence

No cloud resources, paid plan, queue runtime, database/storage setup or deployment was created by the architecture update. No runtime cost measurements exist. Check [SEC-06](../architecture/security-architecture.md) before claiming transport/rest protection or backup readiness.
