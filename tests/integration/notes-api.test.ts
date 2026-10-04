import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { verifyDatabaseSession } from "../../src/server/db/user-context";
import { handleNotes } from "../../src/server/notes/routes";
import { createDatabase, DatabaseFailure } from "../../src/server/db/client";
import { createNoteRepository } from "../../src/server/notes/repository";
import {
  getDatabaseConfig,
  getMigrationConfig,
} from "../../src/server/db/config";
const config = {
  appOrigin: "http://localhost:3000",
  supabaseUrl: "https://fixture.supabase.co",
  publishableKey: "sb_publishable_fixture",
};
const ids: string[] = [randomUUID(), randomUUID()];
const admin = postgres(getMigrationConfig().url, {
  max: 1,
  onnotice: () => {},
});
const database = createDatabase(getDatabaseConfig());
const fetcher: typeof fetch = async (input, init) => {
  const headers = new Headers(
    input instanceof Request ? input.headers : init?.headers,
  );
  const id = headers.get("authorization")?.replace("Bearer verified-", "");
  return ids.includes(id ?? "")
    ? Response.json({
        id,
        aud: "authenticated",
        role: "authenticated",
        email: "fixture@example.invalid",
        app_metadata: {},
        user_metadata: { full_name: "Learner" },
        created_at: new Date().toISOString(),
      })
    : Response.json({ message: "invalid" }, { status: 401 });
};
const deps = { config, fetcher, database };
function req(
  user: number,
  method = "GET",
  path = "",
  body?: unknown,
  key?: string,
  extra: Record<string, string> = {},
) {
  const token = {
    accessToken: `verified-${ids[user]}`,
    refreshToken: "fixture-refresh",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
  return new Request(`http://localhost:3000/api/notes${path}`, {
    method,
    headers: {
      cookie: `mindmora-session=${Buffer.from(JSON.stringify(token)).toString("base64url")}`,
      ...(method !== "GET"
        ? { Origin: config.appOrigin, "Content-Type": "application/json" }
        : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function call(
  user: number,
  method = "GET",
  id?: string,
  body?: unknown,
  key?: string,
  path = "",
  extra: Record<string, string> = {},
) {
  return handleNotes(
    req(user, method, id ? `/${id}` : path, body, key, extra),
    id,
    deps,
  );
}
async function create(user = 0, title = "A", key = randomUUID()) {
  const response = await call(
    user,
    "POST",
    undefined,
    { title, content: "private-content-marker" },
    key,
  );
  expect(response.status).toBe(201);
  return await response.json();
}
beforeAll(async () => {
  await admin`INSERT INTO auth.users(id) VALUES (${ids[0]}),(${ids[1]})`;
});
afterAll(async () => {
  await database.close();
  await admin`DELETE FROM auth.users WHERE id IN (${ids[0]},${ids[1]})`;
  await admin.end();
});
it("uses distinct live database connections for overlapping transactions", async () => {
  const { owner } = await verifyDatabaseSession(req(0), { config, fetcher });
  let arrived = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const timer = setTimeout(release, 2000);
  try {
    const pids = await Promise.all(
      [0, 1].map(() =>
        database.run(owner, async (tx) => {
          const result = await tx.execute(sql`SELECT pg_backend_pid() AS pid`);
          arrived += 1;
          if (arrived === 2) release();
          await barrier;
          expect(arrived).toBe(2);
          return result[0].pid;
        }),
      ),
    );
    expect(new Set(pids).size).toBe(2);
  } finally {
    clearTimeout(timer);
  }
});
it("creates profile/note after commit and exposes normalized owner-scoped data", async () => {
  const note = await create();
  expect(note.userId).toBe(ids[0]);
  expect(note.revision).toBe(1);
  expect(note.createdAt).toMatch(/\.\d{3}Z$/);
  expect(
    await admin`SELECT user_id FROM profiles WHERE user_id=${ids[0]}`,
  ).toHaveLength(1);
  const detail = await call(0, "GET", note.id);
  expect(await detail.json()).toEqual(note);
  expect(detail.headers.get("Cache-Control")).toBe("private, no-store");
  expect(Object.keys(note)).not.toContain("createRequestHash");
});
it("replays creates once and rejects changed payload under an owner-scoped key", async () => {
  const key = randomUUID();
  const note = await create(0, "Replay", key);
  const replay = await call(
    0,
    "POST",
    undefined,
    { title: "Replay", content: "private-content-marker" },
    key,
  );
  expect(replay.status).toBe(200);
  expect((await replay.json()).id).toBe(note.id);
  const changed = await call(
    0,
    "POST",
    undefined,
    { title: "Different", content: "private-content-marker" },
    key,
  );
  expect(changed.status).toBe(409);
  expect((await changed.json()).error.code).toBe("idempotency_conflict");
  const other = await create(1, "Replay", key);
  expect(other.id).not.toBe(note.id);
  expect(
    await admin`SELECT id FROM notes WHERE user_id=${ids[0]} AND create_operation_id=${key}`,
  ).toHaveLength(1);
});
it("deduplicates concurrent creates and supports replay after note changes", async () => {
  const key = randomUUID();
  const responses = await Promise.all([
    call(
      0,
      "POST",
      undefined,
      { title: "Concurrent", content: "private-content-marker" },
      key,
    ),
    call(
      0,
      "POST",
      undefined,
      { title: "Concurrent", content: "private-content-marker" },
      key,
    ),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
  const values = await Promise.all(responses.map((r) => r.json()));
  expect(values[0].id).toBe(values[1].id);
  const updated = await call(0, "PATCH", values[0].id, {
    title: "Renamed",
    expectedRevision: 1,
  });
  expect(updated.status).toBe(200);
  const replay = await call(
    0,
    "POST",
    undefined,
    { title: "Concurrent", content: "private-content-marker" },
    key,
  );
  expect(replay.status).toBe(200);
  expect((await replay.json()).revision).toBe(2);
});
it("rejects foreign detail/update/delete without revealing owned data", async () => {
  const note = await create();
  for (const [method, body] of [
    ["GET", undefined],
    ["PATCH", { title: "Forged", expectedRevision: 1 }],
    ["DELETE", { expectedRevision: 1 }],
  ] as const) {
    const r = await call(1, method, note.id, body);
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("private-content-marker");
  }
});
it("allows only one concurrent update using the same revision", async () => {
  const note = await create();
  const responses = await Promise.all([
    call(0, "PATCH", note.id, { title: "One", expectedRevision: 1 }),
    call(0, "PATCH", note.id, { content: "Two", expectedRevision: 1 }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await (await call(0, "GET", note.id)).json()).revision).toBe(2);
});
it("soft-deletes, excludes deleted rows and never resurrects a create replay", async () => {
  const key = randomUUID();
  const note = await create(0, "Delete", key);
  const result = await call(0, "DELETE", note.id, { expectedRevision: 1 });
  expect(result.status).toBe(200);
  expect((await result.json()).deletedAt).not.toBeNull();
  expect((await call(0, "GET", note.id)).status).toBe(404);
  expect(
    (await call(0, "PATCH", note.id, { title: "Again", expectedRevision: 2 }))
      .status,
  ).toBe(404);
  expect(
    (
      await call(
        0,
        "POST",
        undefined,
        { title: "Delete", content: "private-content-marker" },
        key,
      )
    ).status,
  ).toBe(404);
  expect(
    await admin`SELECT id FROM notes WHERE id=${note.id} AND deleted_at IS NOT NULL`,
  ).toHaveLength(1);
});
it("makes an update/delete race revision-safe", async () => {
  const note = await create();
  const responses = await Promise.all([
    call(0, "PATCH", note.id, { title: "Race", expectedRevision: 1 }),
    call(0, "DELETE", note.id, { expectedRevision: 1 }),
  ]);
  expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
  expect([404, 409]).toContain(responses.find((r) => r.status !== 200)!.status);
});
it("bounds pagination, excludes bodies/foreign rows and rejects forged inputs", async () => {
  const first = await call(
    0,
    "GET",
    undefined,
    undefined,
    undefined,
    "?limit=2",
  );
  expect(first.status).toBe(200);
  const page = await first.json();
  expect(page.items).toHaveLength(2);
  expect(
    page.items.every(
      (n: { userId: string; content?: string }) =>
        n.userId === ids[0] && n.content === undefined,
    ),
  ).toBe(true);
  const second = await call(
    0,
    "GET",
    undefined,
    undefined,
    undefined,
    `?limit=2&cursor=${encodeURIComponent(JSON.stringify(page.nextCursor))}`,
  );
  expect(second.status).toBe(200);
  expect(
    (await second.json()).items.some((n: { id: string }) =>
      page.items.some((a: { id: string }) => a.id === n.id),
    ),
  ).toBe(false);
  for (const path of [
    "?limit=101",
    "?limit=2&limit=3",
    "?cursor=not-json",
    `?userId=${ids[1]}`,
  ])
    expect(
      (await call(0, "GET", undefined, undefined, undefined, path)).status,
    ).toBe(400);
  expect(
    (
      await call(
        0,
        "POST",
        undefined,
        { title: "Forged", content: "", userId: ids[1] },
        randomUUID(),
      )
    ).status,
  ).toBe(400);
  expect(
    (await call(0, "POST", undefined, { title: "No key", content: "" })).status,
  ).toBe(400);
});
it("reports degraded basic admission while still committing owned data", async () => {
  const response = await handleNotes(req(0), undefined, {
    ...deps,
    admission: async () => ({ degraded: true }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("X-RateLimit-Degraded")).toBe("true");
  expect(response.headers.get("Retry-After")).toBeNull();
});
it("rejects PostgreSQL outage without false save or private details", async () => {
  const broken = createDatabase({
    ...getDatabaseConfig(),
    url: "postgresql://mindmora_app:private-password-marker@127.0.0.1:1/postgres",
  });
  try {
    const r = await handleNotes(
      req(
        0,
        "POST",
        "",
        { title: "Outage", content: "private-content-marker" },
        randomUUID(),
      ),
      undefined,
      { ...deps, database: broken },
    );
    expect(r.status).toBe(503);
    const text = await r.text();
    expect(text).not.toContain("private-");
  } finally {
    await broken.close();
  }
});

it("reconciles a response lost after commit using the same create key", async () => {
  const key = randomUUID();
  const repository = createNoteRepository(database);
  let lose = true;
  const uncertain = {
    ...repository,
    create: async (...args: Parameters<typeof repository.create>) => {
      const result = await repository.create(...args);
      if (lose) {
        lose = false;
        throw new DatabaseFailure("connection");
      }
      return result;
    },
  };
  const input = { title: "Uncertain", content: "private-content-marker" };
  const first = await handleNotes(req(0, "POST", "", input, key), undefined, {
    ...deps,
    repository: uncertain,
    admission: async () => ({ degraded: false }),
  });
  expect(first.status).toBe(503);
  const retry = await handleNotes(req(0, "POST", "", input, key), undefined, {
    ...deps,
    repository: uncertain,
    admission: async () => ({ degraded: false }),
  });
  expect(retry.status).toBe(200);
  const note = await retry.json();
  expect(note.revision).toBe(1);
  expect(
    await admin`SELECT id FROM notes WHERE user_id=${ids[0]} AND create_operation_id=${key}`,
  ).toHaveLength(1);
});
