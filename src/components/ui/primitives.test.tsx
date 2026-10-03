import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button, TextField } from "./primitives";
import { TaskRow, SaveStatus } from "../mindmora";
import { ThemeProvider, ThemeSelect } from "./theme";

describe("shared interaction contracts", () => {
  it("retains the action name and blocks duplicate activation while busy", async () => {
    const click = vi.fn();
    render(
      <Button loading onClick={click}>
        Save note
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Save note/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });
  it("associates an invalid field with its actionable error", () => {
    render(
      <TextField label="Note title" error="Enter a title before continuing." />,
    );
    const field = screen.getByRole("textbox", { name: "Note title" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      "Enter a title before continuing.",
    );
  });
  it("emits a task change rather than pretending to persist a task", async () => {
    const change = vi.fn();
    render(
      <TaskRow checked={false} onCheckedChange={change}>
        Read local-first paper
      </TaskRow>,
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Read local-first paper" }),
    );
    expect(change).toHaveBeenCalledWith(true);
  });
  it("never labels a failed local write as saved", () => {
    render(<SaveStatus state="error" />);
    expect(screen.getByRole("status")).toHaveTextContent("Not saved");
    expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
  });
  it("supports explicit themes and returns authority to system CSS", async () => {
    render(
      <ThemeProvider>
        <ThemeSelect />
      </ThemeProvider>,
    );
    const select = screen.getByRole("combobox", { name: "Theme" });
    await userEvent.selectOptions(select, "dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await userEvent.selectOptions(select, "light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await userEvent.selectOptions(select, "system");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});

it("keeps native input descriptions supplied by callers", () => {
  render(
    <>
      <p id="extra-help">Additional guidance.</p>
      <TextField
        label="Filename"
        hint="Use Markdown."
        aria-describedby="extra-help"
      />
    </>,
  );
  expect(
    screen.getByRole("textbox", { name: "Filename" }),
  ).toHaveAccessibleDescription("Additional guidance. Use Markdown.");
});
