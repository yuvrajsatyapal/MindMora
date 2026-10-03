import { describe, expect, it, vi } from "vitest";

// Vitest is not an RSC compiler. The actual client boundary is tested by Next builds.
vi.mock("server-only", () => ({}));
import { getServerConfig } from "./config";

describe("server configuration", () => {
  it("does not require configuration merely to import the module", () => {
    expect(getServerConfig).toBeTypeOf("function");
  });

  it("returns only the validated app origin, excluding unrelated secrets", () => {
    expect(
      getServerConfig({
        APP_ORIGIN: "https://mindmora.example/",
        SUPABASE_SERVICE_ROLE_KEY: "private-marker",
        DATABASE_URL: "postgresql://private-marker",
      }),
    ).toEqual({ appOrigin: "https://mindmora.example" });
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:4173", "http://[::1]:3000"])(
    "allows a loopback development origin: %s",
    (appOrigin) => {
      expect(getServerConfig({ APP_ORIGIN: appOrigin })).toEqual({ appOrigin });
    },
  );

  it.each([
    undefined,
    "",
    "private-marker",
    "http://mindmora.example",
    "ftp://mindmora.example",
    "https://private-marker@mindmora.example",
    "https://mindmora.example/private-marker",
    "https://mindmora.example?key=private-marker",
    "https://mindmora.example#private-marker",
    "http://localhost.evil.example",
  ])("rejects missing or unsafe origins without exposing input: %s", (value) => {
    let failure: unknown;
    try {
      getServerConfig({ APP_ORIGIN: value });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    if (!(failure instanceof Error)) throw new Error("Expected a safe config error");
    expect(failure.message).toBe("Invalid server configuration: APP_ORIGIN.");
    expect(failure.stack).not.toContain("private-marker");
    expect(JSON.stringify(failure)).not.toContain("private-marker");
    expect(failure.cause).toBeUndefined();
  });

  it("reads the current server environment when no input is supplied", () => {
    vi.stubEnv("APP_ORIGIN", "https://runtime.example");
    try {
      expect(getServerConfig()).toEqual({ appOrigin: "https://runtime.example" });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
