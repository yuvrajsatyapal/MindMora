import { describe, expect, it } from "vitest";
import { createNoteSchema } from "./validation";
describe("note input boundary", () => {
  it("rejects a browser-supplied owner", () => {
    expect(
      createNoteSchema.safeParse({
        title: "Note",
        content: "",
        userId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
  });
});

it("rejects empty/oversized titles and UTF-8 bodies beyond 1 MiB", () => {
  for (const title of ["   ", "x".repeat(201)])
    expect(createNoteSchema.safeParse({ title, content: "" }).success).toBe(
      false,
    );
  expect(
    createNoteSchema.safeParse({ title: "Note", content: "🙂".repeat(262145) })
      .success,
  ).toBe(false);
});

it("rejects NUL characters that PostgreSQL TEXT cannot represent", () => {
  expect(
    createNoteSchema.safeParse({ title: "Note", content: "bad\u0000text" })
      .success,
  ).toBe(false);
});

it("requires a changed field and a bounded expected revision for updates", async () => {
  const { updateNoteSchema, deleteNoteSchema, REVISION_MAX } =
    await import("./validation");
  expect(updateNoteSchema.safeParse({ expectedRevision: 1 }).success).toBe(
    false,
  );
  expect(
    updateNoteSchema.safeParse({ content: "", expectedRevision: 1 }).success,
  ).toBe(true);
  expect(
    updateNoteSchema.safeParse({ title: "New", expectedRevision: REVISION_MAX })
      .success,
  ).toBe(false);
  expect(deleteNoteSchema.safeParse({ expectedRevision: 0 }).success).toBe(
    false,
  );
});
it("bounds lists and requires a UTC millisecond cursor with UUID", async () => {
  const { listNotesSchema } = await import("./validation");
  expect(listNotesSchema.parse({})).toEqual({ limit: 20 });
  expect(listNotesSchema.parse({ limit: "100" })).toEqual({ limit: 100 });
  expect(listNotesSchema.safeParse({ limit: 101 }).success).toBe(false);
  expect(
    listNotesSchema.safeParse({
      cursor: { updatedAt: "2026-10-04", id: "bad" },
    }).success,
  ).toBe(false);
});
it("rejects nonnumeric coercions in list limits", async () => {
  const { listNotesSchema } = await import("./validation");
  for (const limit of [true, null, "", [], "1e2"]) {
    expect(listNotesSchema.safeParse({ limit }).success).toBe(false);
  }
});
it("counts profile display names as Unicode code points like PostgreSQL", async () => {
  const { profileSchema } = await import("./types");
  expect(
    profileSchema.safeParse({
      userId: "11111111-1111-4111-8111-111111111111",
      displayName: "😀".repeat(200),
      createdAt: "2026-10-04T00:00:00.000Z",
      updatedAt: "2026-10-04T00:00:00.000Z",
    }).success,
  ).toBe(true);
});
it("rejects profile NUL characters before PostgreSQL", async () => {
  const { profileSchema } = await import("./types");
  expect(
    profileSchema.safeParse({
      userId: "11111111-1111-4111-8111-111111111111",
      displayName: "bad\u0000name",
      createdAt: "2026-10-04T00:00:00.000Z",
      updatedAt: "2026-10-04T00:00:00.000Z",
    }).success,
  ).toBe(false);
});
