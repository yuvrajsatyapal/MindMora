import { beforeAll, afterAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import postgres from "postgres";
import { sql, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../../src/server/db/client";
import {
  getDatabaseConfig,
  getMigrationConfig,
} from "../../src/server/db/config";
import {
  verifyDatabaseSession,
  type VerifiedOwner,
} from "../../src/server/db/user-context";
import { notes, profiles } from "../../src/server/db/schema";
const ids = [randomUUID(), randomUUID()];
const adminConfig = getMigrationConfig();
const admin = postgres(adminConfig.url, {
  prepare: false,
  max: 1,
  ssl: adminConfig.ssl
    ? { rejectUnauthorized: true, ca: adminConfig.ca }
    : false,
  onnotice: () => {},
});
const database = createDatabase(
  getDatabaseConfig({ ...process.env, DATABASE_POOL_MAX: "1" }),
);
let ownerA: VerifiedOwner, ownerB: VerifiedOwner;
async function owner(id: string) {
  const tokens = {
    accessToken: `verified-${id}`,
    refreshToken: "fixture-refresh",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
  const request = new Request("http://localhost:3000", {
    headers: {
      cookie: `mindmora-session=${Buffer.from(JSON.stringify(tokens)).toString("base64url")}`,
    },
  });
  const fetcher: typeof fetch = async () =>
    Response.json({
      id,
      aud: "authenticated",
      role: "authenticated",
      email: "test@example.invalid",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    });
  return (
    await verifyDatabaseSession(request, {
      config: {
        appOrigin: "http://localhost:3000",
        supabaseUrl: "https://fixture.supabase.co",
        publishableKey: "sb_publishable_fixture",
      },
      fetcher,
    })
  ).owner;
}
beforeAll(async () => {
  // Disposable IDs only; hosted tests use real auth.users and auth.uid(), never replace them.
  await admin`INSERT INTO auth.users (id) VALUES (${ids[0]}), (${ids[1]})`;
  ownerA = await owner(ids[0]);
  ownerB = await owner(ids[1]);
});
afterAll(async () => {
  await database.close();
  await admin`DELETE FROM auth.users WHERE id IN (${ids[0]},${ids[1]})`;
  await admin.end({ timeout: 5 });
});
it("a verified owner can insert/read its profile through the actual runtime role", async () => {
  await database.run(ownerA, async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId: ownerA.userId, displayName: "A" });
    expect(await tx.select().from(profiles)).toHaveLength(1);
  });
});
it("rejects a privileged connection even for a valid verified owner", async () => {
  const privileged = createDatabase(getMigrationConfig());
  try {
    await expect(
      privileged.run(ownerA, async (tx) => tx.execute(sql`SELECT 1`)),
    ).rejects.toThrow("Database operation unavailable.");
  } finally {
    await privileged.close();
  }
});
let noteA: string, noteB: string;
it("isolates two users for read, update, soft-delete and forged ownership", async () => {
  await database.run(ownerB, async (tx) => {
    await tx
      .insert(profiles)
      .values({ userId: ownerB.userId, displayName: "B" });
    const [note] = await tx
      .insert(notes)
      .values({ userId: ownerB.userId, title: "B", content: "private B" })
      .returning();
    noteB = note.id;
  });
  await database.run(ownerA, async (tx) => {
    const [note] = await tx
      .insert(notes)
      .values({ userId: ownerA.userId, title: "A", content: "private A" })
      .returning();
    noteA = note.id;
    expect(note.revision).toBe(1);
    expect(note.createdAt).toBeInstanceOf(Date);
    expect(note.deletedAt).toBeNull();
    expect((await tx.select().from(notes)).map((n) => n.id)).toEqual([noteA]);
    expect(
      await tx.select().from(notes).where(eq(notes.id, noteB)),
    ).toHaveLength(0);
    expect(
      await tx
        .update(notes)
        .set({ content: "stolen" })
        .where(eq(notes.id, noteB))
        .returning(),
    ).toHaveLength(0);
    expect(
      await tx
        .update(notes)
        .set({ deletedAt: new Date() })
        .where(eq(notes.id, noteB))
        .returning(),
    ).toHaveLength(0);
  });
  await expect(
    database.run(ownerA, async (tx) =>
      tx
        .insert(notes)
        .values({ userId: ownerB.userId, title: "forged", content: "" }),
    ),
  ).rejects.toThrow("Database operation unavailable.");
  await expect(
    database.run(ownerA, async (tx) =>
      tx.execute(
        sql`UPDATE public.notes SET user_id = ${ownerB.userId} WHERE id = ${noteA}`,
      ),
    ),
  ).rejects.toThrow();
  await expect(
    database.run(ownerA, async (tx) =>
      tx.execute(sql`DELETE FROM public.notes WHERE id = ${noteA}`),
    ),
  ).rejects.toThrow();
  expect(
    await database.run(ownerB, async (tx) =>
      tx.select().from(notes).where(eq(notes.id, noteB)),
    ),
  ).toMatchObject([{ content: "private B", deletedAt: null }]);
});
it("does not accept a manufactured owner object or an unauthenticated request", async () => {
  await expect(
    database.run({ userId: ownerA.userId }, async () => true),
  ).rejects.toThrow("Authentication required.");
  await expect(
    verifyDatabaseSession(new Request("http://localhost"), {
      config: {
        appOrigin: "http://localhost",
        supabaseUrl: "https://fixture.supabase.co",
        publishableKey: "sb_publishable_fixture",
      },
    }),
  ).rejects.toThrow("Authentication required.");
});
it("has effective RLS, constrained roles and no direct app or anonymous table access", async () => {
  const roles =
    await admin`SELECT rolname,rolsuper,rolbypassrls,rolinherit,rolcanlogin,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname IN ('mindmora_app','mindmora_request') ORDER BY rolname`;
  expect(roles).toMatchObject([
    {
      rolname: "mindmora_app",
      rolsuper: false,
      rolbypassrls: false,
      rolinherit: false,
      rolcanlogin: true,
      rolcreaterole: false,
      rolcreatedb: false,
    },
    {
      rolname: "mindmora_request",
      rolsuper: false,
      rolbypassrls: false,
      rolinherit: false,
      rolcanlogin: false,
      rolcreaterole: false,
      rolcreatedb: false,
    },
  ]);
  const tables =
    await admin`SELECT relname,relrowsecurity,relforcerowsecurity,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid IN ('public.notes'::regclass,'public.profiles'::regclass)`;
  expect(tables).toHaveLength(2);
  for (const table of tables) {
    expect(table.relrowsecurity).toBe(true);
    expect(table.relforcerowsecurity).toBe(true);
    expect(table.owner).not.toBe("mindmora_app");
    expect(table.owner).not.toBe("mindmora_request");
  }
  const runtime = getDatabaseConfig();
  const bare = postgres(runtime.url, {
    max: 1,
    prepare: false,
    ssl: runtime.ssl ? { rejectUnauthorized: true, ca: runtime.ca } : false,
    onnotice: () => {},
  });
  try {
    await expect(bare`SELECT * FROM public.notes`).rejects.toMatchObject({
      code: "42501",
    });
    await bare
      .begin(async (tx) => {
        await tx`SET LOCAL ROLE mindmora_request`;
        expect(await tx`SELECT * FROM public.notes`).toHaveLength(0);
        await expect(
          tx`INSERT INTO public.notes (user_id,title,content) VALUES (${ownerA.userId},'no claims','')`,
        ).rejects.toMatchObject({ code: "42501" });
      })
      .catch((error) => {
        if (!["42501", "25P02"].includes(error.code)) throw error;
      });
  } finally {
    await bare.end({ timeout: 5 });
  }
  await admin
    .begin(async (tx) => {
      await tx`SET LOCAL ROLE anon`;
      await expect(tx`SELECT * FROM public.notes`).rejects.toMatchObject({
        code: "42501",
      });
    })
    .catch((error) => {
      if (!["42501", "25P02"].includes(error.code)) throw error;
    });
});
it("restores identity/role after commit and rollback on the same one-connection pool", async () => {
  const a = await database.run(ownerA, async (tx) =>
    tx.execute(
      sql`SELECT pg_backend_pid() AS pid, current_user AS role, current_setting('request.jwt.claim.sub')::uuid AS uid`,
    ),
  );
  await expect(
    database.run(ownerA, async (tx) => {
      await tx
        .update(notes)
        .set({ content: "must rollback" })
        .where(eq(notes.id, noteA));
      throw new Error("rollback-marker");
    }),
  ).rejects.toThrow("Database operation unavailable.");
  const b = await database.run(ownerB, async (tx) => {
    expect((await tx.select().from(notes)).map((n) => n.id)).toEqual([noteB]);
    return tx.execute(
      sql`SELECT pg_backend_pid() AS pid, current_user AS role, current_setting('request.jwt.claim.sub')::uuid AS uid`,
    );
  });
  expect(a[0].pid).toBe(b[0].pid);
  expect(a[0]).toMatchObject({ role: "mindmora_request", uid: ownerA.userId });
  expect(b[0]).toMatchObject({ role: "mindmora_request", uid: ownerB.userId });
  const contents = await database.run(ownerA, async (tx) =>
    tx.select().from(notes).where(eq(notes.id, noteA)),
  );
  expect(contents[0].content).toBe("private A");
  const concurrent = await Promise.all(
    [ownerA, ownerB, ownerA, ownerB].map((who) =>
      database.run(who, async (tx) =>
        tx.execute(
          sql`SELECT current_setting('request.jwt.claim.sub')::uuid AS uid`,
        ),
      ),
    ),
  );
  expect(concurrent.map((r) => r[0].uid)).toEqual([
    ownerA.userId,
    ownerB.userId,
    ownerA.userId,
    ownerB.userId,
  ]);
});
it("enforces real database bounds, revisions, timestamps, foreign keys and safe errors", async () => {
  for (const values of [
    { title: "", content: "" },
    { title: "x".repeat(201), content: "" },
    { title: "ok", content: "é".repeat(524289) },
    { title: "ok", content: "", revision: 0 },
    { title: "ok", content: "", updatedAt: new Date(0) },
  ]) {
    await expect(
      database.run(ownerA, async (tx) =>
        tx.insert(notes).values({ userId: ownerA.userId, ...values }),
      ),
    ).rejects.toThrow("Database operation unavailable.");
  }
  await expect(
    database.run(ownerA, async (tx) =>
      tx.insert(profiles).values({ userId: randomUUID() }),
    ),
  ).rejects.toThrow();
  await expect(
    admin`INSERT INTO public.profiles (user_id) VALUES (${randomUUID()})`,
  ).rejects.toMatchObject({ code: "23503" });
  const error = await database
    .run(ownerA, async (tx) =>
      tx.insert(notes).values({
        userId: ownerA.userId,
        title: "private-marker".repeat(30),
        content: "secret-body-marker",
      }),
    )
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).toBe("Error: Database operation unavailable.");
  expect(error).not.toHaveProperty("cause");
});
