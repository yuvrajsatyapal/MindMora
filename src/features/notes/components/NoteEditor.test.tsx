import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { NoteEditor } from "./NoteEditor";
import { ApiError } from "../../../lib/api/client";
import type { NotesApi } from "../api";
const note = {
  id: "33333333-3333-4333-8333-333333333333",
  userId: "11111111-1111-4111-8111-111111111111",
  title: "Title",
  content: "Body",
  revision: 1,
  createdAt: "2026-10-05T00:00:00.000Z",
  updatedAt: "2026-10-05T00:00:00.000Z",
  deletedAt: null,
};
function api(overrides: Partial<NotesApi> = {}): NotesApi {
  return {
    list: vi.fn(),
    read: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}
it("saves an edited draft and shows saved only after server acknowledgement", async () => {
  const user = userEvent.setup();
  const saved = vi.fn();
  let finish!: (value: typeof note) => void;
  render(
    <NoteEditor
      note={note}
      api={api({
        update: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      })}
      onSaved={saved}
      onDeleted={vi.fn()}
      onDirty={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("Markdown content"), " edit");
  await user.click(screen.getByRole("button", { name: "Save note" }));
  expect(screen.queryByText("Saved to server")).not.toBeInTheDocument();
  finish({ ...note, content: "Body edit", revision: 2 });
  await waitFor(() =>
    expect(screen.getByText("Saved to server")).toBeInTheDocument(),
  );
  expect(saved).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
});
it("keeps dirty draft when a refetch returns a newer version and on conflict", async () => {
  const user = userEvent.setup();
  const latest = { ...note, content: "Other tab", revision: 2 };
  const service = api({
    update: async () => {
      throw new ApiError("revision_conflict", 409);
    },
    read: async () => latest,
  });
  const props = {
    api: service,
    onSaved: vi.fn(),
    onDeleted: vi.fn(),
    onDirty: vi.fn(),
  };
  const view = render(<NoteEditor note={note} {...props} />);
  await user.type(screen.getByLabelText("Markdown content"), " draft");
  view.rerender(<NoteEditor note={latest} {...props} />);
  expect(screen.getByLabelText("Markdown content")).toHaveValue("Body draft");
  await user.click(screen.getByRole("button", { name: "Save note" }));
  expect(
    await screen.findByRole("button", {
      name: "Keep draft with latest revision",
    }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Markdown content")).toHaveValue("Body draft");
});
it("retries uncertain create with the original operation key and frozen payload", async () => {
  const user = userEvent.setup();
  const calls: Array<{ input: unknown; key: string }> = [];
  const service = api({
    create: async (input, key) => {
      calls.push({ input, key });
      if (calls.length === 1) throw new ApiError("uncertain");
      return note;
    },
  });
  render(
    <NoteEditor
      note={null}
      api={service}
      onSaved={vi.fn()}
      onDeleted={vi.fn()}
      onDirty={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("Title"), "New");
  await user.type(screen.getByLabelText("Markdown content"), "Draft");
  await user.click(screen.getByRole("button", { name: "Save note" }));
  await user.click(
    await screen.findByRole("button", { name: "Retry same create" }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1]).toEqual(calls[0]);
});
it("retains the original create draft when idempotent replay returns a concurrently edited record", async () => {
  const user = userEvent.setup();
  let count = 0;
  const service = api({
    create: async () => {
      if (++count === 1) throw new ApiError("uncertain");
      return { ...note, content: "Edited elsewhere", revision: 2 };
    },
  });
  render(
    <NoteEditor
      note={null}
      api={service}
      onSaved={vi.fn()}
      onDeleted={vi.fn()}
      onDirty={vi.fn()}
    />,
  );
  await user.type(screen.getByLabelText("Title"), "Original");
  await user.type(screen.getByLabelText("Markdown content"), "Original draft");
  await user.click(screen.getByRole("button", { name: "Save note" }));
  await user.click(
    await screen.findByRole("button", { name: "Retry same create" }),
  );
  await screen.findByRole("button", {
    name: "Keep draft with latest revision",
  });
  expect(screen.getByLabelText("Markdown content")).toHaveValue(
    "Original draft",
  );
});

it("refreshes a clean editor to the newest committed revision", () => {
  const props = {
    api: api(),
    onSaved: vi.fn(),
    onDeleted: vi.fn(),
    onDirty: vi.fn(),
  };
  const view = render(<NoteEditor note={note} {...props} />);
  view.rerender(
    <NoteEditor
      note={{
        ...note,
        title: "Renamed elsewhere",
        content: "Newest server body",
        revision: 2,
      }}
      {...props}
    />,
  );
  expect(screen.getByLabelText("Title")).toHaveValue("Renamed elsewhere");
  expect(screen.getByLabelText("Markdown content")).toHaveValue(
    "Newest server body",
  );
  expect(screen.getByText("Saved to server")).toBeInTheDocument();
});

it("retains a dirty draft but disables writes when the note is confirmed unavailable", async () => {
  const user = userEvent.setup();
  const props = {
    api: api(),
    onSaved: vi.fn(),
    onDeleted: vi.fn(),
    onDirty: vi.fn(),
  };
  const view = render(<NoteEditor note={note} {...props} />);
  await user.type(screen.getByLabelText("Markdown content"), " retain");
  view.rerender(<NoteEditor note={note} unavailable {...props} />);
  expect(screen.getByLabelText("Markdown content")).toHaveValue("Body retain");
  expect(screen.getByRole("button", { name: "Save note" })).toBeDisabled();
  expect(screen.getByText("Note no longer available")).toBeInTheDocument();
});
