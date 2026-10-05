import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { ThemeProvider } from "../ui/theme";
import { WorkspaceShell } from "./WorkspaceShell";
const owner = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    email: null,
    displayName: "Owner",
  },
};
afterEach(() => vi.unstubAllGlobals());
function mount() {
  return render(
    <NuqsTestingAdapter>
      <ThemeProvider><WorkspaceShell /></ThemeProvider>
    </NuqsTestingAdapter>,
  );
}
it("shows the sign-in gate for an unauthenticated session", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 401 })),
  );
  mount();
  expect(
    await screen.findByRole("button", { name: "Continue with Google" }),
  ).toBeInTheDocument();
});
it("loads the protected empty workspace only after session verification", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/session")
        ? Response.json(owner)
        : Response.json({ items: [], nextCursor: null }),
    ),
  );
  mount();
  expect(
    await screen.findByRole("heading", { name: "Your notes" }),
  ).toBeInTheDocument();
  expect(await screen.findByText("No notes yet")).toBeInTheDocument();
});
it("clears private editor immediately when a verified account switch is detected", async () => {
  let current = owner;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/session")
        ? Response.json(current)
        : Response.json({ items: [], nextCursor: null }),
    ),
  );
  mount();
  await screen.findByRole("heading", { name: "Your notes" });
  current = {
    user: {
      ...owner.user,
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "Other",
    },
  };
  window.dispatchEvent(new Event("focus"));
  await waitFor(() => expect(screen.getByText("Other")).toBeInTheDocument());
  expect(screen.queryByText("Owner")).not.toBeInTheDocument();
});
it("retains same-tab draft when session verification has a transient network failure", async () => {
  let offline = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (offline) throw new Error("Offline");
      return url.includes("/session")
        ? Response.json(owner)
        : Response.json({ items: [], nextCursor: null });
    }),
  );
  mount();
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("Markdown content"),
    "Retain this draft",
  );
  offline = true;
  window.dispatchEvent(new Event("focus"));
  await screen.findByText(
    "Session verification failed. Retry to access your notes.",
  );
  expect(screen.getByLabelText("Markdown content")).toHaveValue(
    "Retain this draft",
  );
});
it("does not rehydrate a previous identity while sign out is in flight", async () => {
  let release!: () => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/logout")) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return new Response(null, { status: 204 });
      }
      return url.includes("/session")
        ? Response.json(owner)
        : Response.json({ items: [], nextCursor: null });
    }),
  );
  mount();
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Sign out" }));
  window.dispatchEvent(new Event("focus"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(screen.queryByText("Owner")).not.toBeInTheDocument();
  release();
  await screen.findByRole("button", { name: "Continue with Google" });
});
it("preserves a valid initial note URL during first session verification", async () => {
  const onUrlUpdate = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/session")
        ? Response.json(owner)
        : url.includes("33333333")
          ? new Response(null, { status: 404 })
          : Response.json({ items: [], nextCursor: null }),
    ),
  );
  render(
    <NuqsTestingAdapter
      searchParams="?note=33333333-3333-4333-8333-333333333333"
      onUrlUpdate={onUrlUpdate}
    >
      <ThemeProvider><WorkspaceShell /></ThemeProvider>
    </NuqsTestingAdapter>,
  );
  await screen.findByText("Note unavailable");
  expect(onUrlUpdate).not.toHaveBeenCalled();
});

it("retains a dirty draft and restores the URL when an external selection is declined", async () => {
  const { useQueryState } = await import("nuqs");
  function ExternalSelection() {
    const [, setSelection] = useQueryState("note");
    return (
      <button onClick={() => void setSelection("invalid-url-note")}>
        External selection
      </button>
    );
  }
  const onUrlUpdate = vi.fn();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("/session")
        ? Response.json(owner)
        : Response.json({ items: [], nextCursor: null }),
    ),
  );
  render(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate}>
      <ExternalSelection />
      <ThemeProvider><WorkspaceShell /></ThemeProvider>
    </NuqsTestingAdapter>,
  );
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("Markdown content"),
    "Keep my draft",
  );
  await user.click(screen.getByRole("button", { name: "External selection" }));
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(screen.getByLabelText("Markdown content")).toHaveValue(
    "Keep my draft",
  );
  await waitFor(() =>
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("note")).toBeNull(),
  );
  confirm.mockRestore();
});

it.each([false, true])(
  "handles confirmed detail 404 after cached data with dirty=%s",
  async (dirty) => {
    const stored = {
      id: "33333333-3333-4333-8333-333333333333",
      userId: owner.user.id,
      title: "Stored",
      content: "Server body",
      revision: 1,
      createdAt: "2026-10-05T00:00:00.000Z",
      updatedAt: "2026-10-05T00:00:00.000Z",
      deletedAt: null,
    };
    let deleted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/session")) return Response.json(owner);
        if (url.includes(stored.id))
          return deleted
            ? Response.json(
                {
                  error: {
                    code: "not_found",
                    message: "Record not found.",
                    correlationId: "44444444-4444-4444-8444-444444444444",
                  },
                },
                { status: 404 },
              )
            : Response.json(stored);
        return Response.json({ items: [], nextCursor: null });
      }),
    );
    render(
      <NuqsTestingAdapter searchParams={`?note=${stored.id}`}>
        <ThemeProvider><WorkspaceShell /></ThemeProvider>
      </NuqsTestingAdapter>,
    );
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const editor = await screen.findByLabelText("Markdown content");
    if (dirty) await user.type(editor, " retained draft");
    deleted = true;
    await user.click(screen.getByRole("button", { name: "Refresh notes" }));
    if (dirty) {
      await screen.findByText("Note no longer available");
      expect(screen.getByLabelText("Markdown content")).toHaveValue(
        "Server body retained draft",
      );
      expect(screen.getByRole("button", { name: "Save note" })).toBeDisabled();
    } else {
      await screen.findByText("Note unavailable");
      expect(
        screen.queryByLabelText("Markdown content"),
      ).not.toBeInTheDocument();
    }
  },
);

vi.mock("../../features/editor/components/CodeMirrorEditor", () => ({CodeMirrorEditor: ({value,onChange}: ComponentProps<typeof import("../../features/editor/components/CodeMirrorEditor").CodeMirrorEditor>) => <textarea aria-label="Markdown content" value={value} onChange={event=>onChange(event.target.value)}/> }));
