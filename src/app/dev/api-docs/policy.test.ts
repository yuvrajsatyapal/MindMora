import { describe, expect, it } from "vitest";
import { docsEnabled, sameOriginRequest } from "./policy";
describe("API console exposure and outgoing requests", () => {
  it("requires exact opt-in outside development", () => {
    expect(docsEnabled("production", undefined)).toBe(false);
    expect(docsEnabled("production", "false")).toBe(false);
    expect(docsEnabled("production", "true")).toBe(true);
    expect(docsEnabled("development", undefined)).toBe(true);
  });
  it("locks cookies and requests to this application's API", () => {
    expect(
      sameOriginRequest(
        { url: "/api/notes", credentials: "include" },
        "https://app.test",
      ).credentials,
    ).toBe("same-origin");
    for (const url of [
      "https://other.test/api/notes",
      "//other.test/api/notes",
      "/other",
      "/api/auth/start",
      "/api/auth/callback",
      "/api/auth/start/",
      "/api/auth/callback/",
      "https://user:pass@app.test/api/notes",
    ])
      expect(() => sameOriginRequest({ url }, "https://app.test")).toThrow();
  });
});
