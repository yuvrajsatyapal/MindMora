# Local-First Architecture — Historical

**Status:** ❌ Superseded on 2026-10-03 by user-approved full-stack storage.

The v2 plan used Dexie/IndexedDB as authority, encrypted device vaults and automatic Drive synchronization, with durable offline notes. No knowledge persistence or encrypted vault implementation was built under that plan.

Current requirements: [full-stack architecture](full-stack-architecture.md), [security contract](security-architecture.md) and [ADR-018](../decisions/ADR-018-full-stack-server-storage.md). Supabase PostgreSQL is authoritative; browser notes/cache are temporary memory only; no E2EE vault or durable offline sync. This file is retained to preserve old links and history, not as implementation instructions.
