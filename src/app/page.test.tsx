import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";
import { ThemeProvider } from "../components/ui/theme";

test("homepage provides honest note introduction, real navigation and accessible theme control", () => {
  render(<ThemeProvider><Home /></ThemeProvider>);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A place for your thinking.");
  expect(screen.getByRole("link", { name: /Open your workspace/ })).toHaveAttribute("href", "/workspace/");
  expect(screen.getByRole("link", { name: /Design system/ })).toHaveAttribute("href", "/dev/design-system/");
  expect(screen.getByText("Example note")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Theme", { exact: true }), { target: { value: "dark" } });
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  expect(screen.queryByText("Saved to server")).not.toBeInTheDocument();
});
