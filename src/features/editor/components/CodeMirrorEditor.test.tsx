import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createRef } from "react";
import { CodeMirrorEditor, type EditorHandle } from "./CodeMirrorEditor";
it("mounts a labelled source textbox and adopts programmatic content without change loops", () => {
  const change = vi.fn();
  const handle = createRef<EditorHandle>();
  const props = {onChange: change, onSave: vi.fn(), nonce: "test-nonce", handle};
  const view = render(<CodeMirrorEditor value="old" {...props} />);
  expect(screen.getByRole("textbox", {name: "Markdown content"})).toHaveTextContent("old");
  view.rerender(<CodeMirrorEditor value="new" {...props} />);
  expect(screen.getByRole("textbox", {name: "Markdown content"})).toHaveTextContent("new");
  expect(change).not.toHaveBeenCalled();
  view.unmount();
  expect(handle.current).toBeNull();
});
