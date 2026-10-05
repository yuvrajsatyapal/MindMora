import { afterEach, expect, it, vi } from "vitest";
import { createNotesApi } from "./api";
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const note = {
  id: "33333333-3333-4333-8333-333333333333",
  userId: ownerId,
  title: "Private",
  content: "Body",
  revision: 1,
  createdAt: "2026-10-05T00:00:00.000Z",
  updatedAt: "2026-10-05T00:00:00.000Z",
  deletedAt: null,
};
afterEach(() => vi.unstubAllGlobals());
it("returns validated notes only for the verified owner", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(note)),
  );
  const api = createNotesApi({
    ownerId,
    generation: 1,
    assertActive() {},
    async verify() {},
  });
  await expect(api.read(note.id)).resolves.toEqual(note);
});
it("rejects a foreign owner list before rendering any private result", async () => {
  const summary = {
    id: note.id,
    userId: note.userId,
    title: note.title,
    revision: note.revision,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    deletedAt: note.deletedAt,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        items: [{ ...summary, userId: otherId }],
        nextCursor: null,
      }),
    ),
  );
  const api = createNotesApi({
    ownerId,
    generation: 1,
    assertActive() {},
    async verify() {},
  });
  await expect(api.list()).rejects.toThrow();
});
it("invalidates a late list response after logout", async () => {
  let active = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      active = false;
      return Response.json({ items: [], nextCursor: null });
    }),
  );
  const api = createNotesApi({
    ownerId,
    generation: 1,
    assertActive() {
      if (!active) throw new Error("Session changed");
    },
    async verify() {},
  });
  await expect(api.list()).rejects.toThrow();
});
it("accepts full committed soft-delete records but rejects a non-deleted acknowledgement", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        ...note,
        deletedAt: "2026-10-05T00:01:00.000Z",
        revision: 2,
      }),
    ),
  );
  const api = createNotesApi({
    ownerId,
    generation: 1,
    assertActive() {},
    async verify() {},
  });
  await expect(api.remove(note.id, 1)).resolves.toBeUndefined();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(note)),
  );
  await expect(api.remove(note.id, 1)).rejects.toThrow();
});
it("invalidates the session when the API confirms unauthenticated access after verification", async () => {
  const invalidate = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          error: {
            code: "unauthenticated",
            message: "Authentication required.",
            correlationId: "44444444-4444-4444-8444-444444444444",
          },
        },
        { status: 401 },
      ),
    ),
  );
  const api = createNotesApi({
    ownerId,
    generation: 1,
    assertActive() {},
    async verify() {},
    invalidate,
  });
  await expect(api.list()).rejects.toThrow();
  expect(invalidate).toHaveBeenCalledOnce();
});
it("rejects a different same-owner detail record from the requested URL", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ ...note, id: "55555555-5555-4555-8555-555555555555" }),
    ),
  );
  const api = createNotesApi({
    ownerId,
    generation: 1,
    assertActive() {},
    async verify() {},
  });
  await expect(api.read(note.id)).rejects.toThrow();
});
