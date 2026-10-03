// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { handleAuth } from "./routes";
import {
  authProviderFixture,
  fixtureUser,
} from "../../tests/auth-provider-fixture";

const config = {
  appOrigin: "https://mindmora.example",
  supabaseUrl: "https://project.supabase.co",
  publishableKey: "sb_publishable_fixture",
};
function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .filter((value) => !value.includes("Max-Age=0"))
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}
function request(
  path: string,
  method = "GET",
  cookies = "",
  origin: string | null = config.appOrigin,
) {
  return new Request(new URL(path, config.appOrigin), {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });
}
async function login(fixture = authProviderFixture()) {
  const deps = { config, fetcher: fixture.fetcher };
  const start = await handleAuth(
    "start",
    request("/api/auth/start", "POST"),
    deps,
  );
  const location = start.headers.get("location");
  expect(start.status).toBe(303);
  expect(location).toBeTruthy();
  const callbackUrl = fixture.authorize(location!);
  const callback = await handleAuth(
    "callback",
    request(callbackUrl, "GET", cookie(start), null),
    deps,
  );
  return { fixture, deps, start, callback, callbackUrl };
}

describe("backend-owned auth routes through the real Supabase SDK", () => {
  it("uses PKCE and fixed redirects with short-lived protected pending cookies", async () => {
    const { start, callback } = await login();
    expect(callback.status).toBe(303);
    expect(callback.headers.get("location")).toBe("https://mindmora.example/");
    const pending = start.headers.getSetCookie().join(";");
    expect(pending).toContain("__Host-mindmora-pending=");
    for (const attribute of [
      "HttpOnly",
      "Secure",
      "SameSite=lax",
      "Path=/",
      "Max-Age=600",
    ])
      expect(pending.toLowerCase()).toContain(attribute.toLowerCase());
    expect(pending).not.toContain("Domain=");
    const auth = callback.headers.getSetCookie().join(";");
    expect(auth).toContain("__Host-mindmora-session=");
    expect(auth).toContain("HttpOnly");
    expect(auth).not.toContain("google-private-marker");
    expect(
      Buffer.from(cookie(callback).split("=")[1], "base64url").toString(),
    ).not.toContain("google-private-marker");
  });

  it("verifies user remotely and returns a token-free minimal projection with no-store", async () => {
    const { callback, deps, fixture } = await login();
    const response = await handleAuth(
      "session",
      request("/api/auth/session", "GET", cookie(callback)),
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      user: {
        id: fixtureUser.id,
        email: "learner@example.test",
        displayName: "MindMora Learner",
      },
    });
    expect(
      fixture.calls.filter((path) => path.endsWith("/user")).length,
    ).toBeGreaterThanOrEqual(2);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each(["start", "logout"] as const)(
    "rejects foreign and missing Origin on %s before provider work",
    async (action) => {
      const fixture = authProviderFixture();
      for (const origin of [null, "https://attacker.example", "null"])
        expect(
          (
            await handleAuth(
              action,
              request(`/api/auth/${action}`, "POST", "", origin),
              { config, fetcher: fixture.fetcher },
            )
          ).status,
        ).toBe(403);
      expect(fixture.calls).toEqual([]);
    },
  );

  it("rejects redirect inputs rather than accepting arbitrary post-login destinations", async () => {
    const fixture = authProviderFixture();
    const response = await handleAuth(
      "start",
      request("/api/auth/start?next=https://attacker.example", "POST"),
      { config, fetcher: fixture.fetcher },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("location")).toBeNull();
  });

  it("returns non-cacheable method errors with the supported method", async () => {
    for (const action of ["start", "logout", "callback", "session"] as const) {
      const supported =
        action === "start" || action === "logout" ? "POST" : "GET";
      const wrong = supported === "POST" ? "GET" : "POST";
      const response = await handleAuth(
        action,
        request(`/api/auth/${action}`, wrong),
        { config, fetcher: authProviderFixture().fetcher },
      );
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe(supported);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });

  it("rejects oversized provider credentials without issuing a partial session cookie", async () => {
    const fixture = authProviderFixture();
    const start = await handleAuth(
      "start",
      request("/api/auth/start", "POST"),
      { config, fetcher: fixture.fetcher },
    );
    const callbackUrl = fixture.authorize(start.headers.get("location")!);
    const fetcher: typeof fetch = async (input, init) => {
      if (String(input).includes("grant_type=pkce"))
        return Response.json({
          ...fixture.issue(),
          access_token: "private-marker".repeat(400),
        });
      return fixture.fetcher(input, init);
    };
    const response = await handleAuth(
      "callback",
      request(callbackUrl, "GET", cookie(start), null),
      { config, fetcher },
    );
    expect(response.status).toBe(503);
    expect(cookie(response)).toBe("");
    expect(await response.text()).not.toContain("private-marker");
  });

  it("rejects missing pending cookie and mismatched state without code exchange", async () => {
    const { start, callbackUrl, deps, fixture } = await login();
    const before = fixture.calls.length;
    expect(
      (
        await handleAuth(
          "callback",
          request(callbackUrl, "GET", "", null),
          deps,
        )
      ).status,
    ).toBe(400);
    const wrong = new URL(callbackUrl);
    wrong.searchParams.set("state", "wrong-state");
    expect(
      (
        await handleAuth(
          "callback",
          request(wrong.toString(), "GET", cookie(start), null),
          deps,
        )
      ).status,
    ).toBe(400);
    expect(fixture.calls.length).toBe(before);
  });

  it("rejects non-ASCII callback state without throwing a timing-comparison error", async () => {
    const { start, callbackUrl, deps } = await login();
    const invalid = new URL(callbackUrl);
    invalid.searchParams.set("state", "é".repeat(43));
    const response = await handleAuth(
      "callback",
      request(invalid.toString(), "GET", cookie(start), null),
      deps,
    );
    expect(response.status).toBe(400);
  });

  it("rejects expired pending flows and provider error callbacks without exposing descriptions", async () => {
    const fixture = authProviderFixture();
    const deps = { config, fetcher: fixture.fetcher };
    const start = await handleAuth(
      "start",
      request("/api/auth/start", "POST"),
      deps,
    );
    const url = fixture.authorize(start.headers.get("location")!);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 601_000);
      expect(
        (
          await handleAuth(
            "callback",
            request(url, "GET", cookie(start), null),
            deps,
          )
        ).status,
      ).toBe(400);
    } finally {
      vi.useRealTimers();
    }
    const error = await handleAuth(
      "callback",
      request(
        "/api/auth/callback?error=access_denied&error_description=private-marker",
        "GET",
        cookie(start),
        null,
      ),
      deps,
    );
    expect(error.status).toBe(400);
    expect(await error.text()).not.toContain("private-marker");
  });

  it("cannot exchange a code with another browser's PKCE verifier or replay a code", async () => {
    const { start, callbackUrl, deps } = await login();
    expect(
      (
        await handleAuth(
          "callback",
          request(callbackUrl, "GET", cookie(start), null),
          deps,
        )
      ).status,
    ).toBe(401);
    const fixture = authProviderFixture();
    const different = { config, fetcher: fixture.fetcher };
    const one = await handleAuth(
      "start",
      request("/api/auth/start", "POST"),
      different,
    );
    const two = await handleAuth(
      "start",
      request("/api/auth/start", "POST"),
      different,
    );
    const wrongCode = fixture.authorize(one.headers.get("location")!);
    const mixed = new URL(wrongCode);
    mixed.searchParams.set(
      "state",
      new URL(fixture.authorize(two.headers.get("location")!)).searchParams.get(
        "state",
      )!,
    );
    expect(
      (
        await handleAuth(
          "callback",
          request(mixed.toString(), "GET", cookie(two), null),
          different,
        )
      ).status,
    ).toBe(401);
  });

  it("denies missing/corrupt cookies and revoked sessions", async () => {
    const { callback, deps, fixture } = await login();
    for (const cookies of ["", "__Host-mindmora-session=corrupt"])
      expect(
        (
          await handleAuth(
            "session",
            request("/api/auth/session", "GET", cookies),
            deps,
          )
        ).status,
      ).toBe(401);
    fixture.revoke();
    const response = await handleAuth(
      "session",
      request("/api/auth/session", "GET", cookie(callback)),
      deps,
    );
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
  });

  it("refreshes expired sessions server-side and writes rotated protected cookies", async () => {
    const { callback, deps, fixture } = await login();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 3_700_000);
      const response = await handleAuth(
        "session",
        request("/api/auth/session", "GET", cookie(callback)),
        deps,
      );
      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie().join(";")).toContain("HttpOnly");
      expect(cookie(response)).not.toBe(cookie(callback));
      expect(
        fixture.calls.some((path) => path.includes("grant_type=refresh_token")),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails closed and clears invalid refresh credentials", async () => {
    const { callback, deps, fixture } = await login();
    fixture.rejectRefresh();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 3_700_000);
      const response = await handleAuth(
        "session",
        request("/api/auth/session", "GET", cookie(callback)),
        deps,
      );
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain("private-refresh-marker");
      expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports provider outage without logging/serializing errors or clearing a valid cookie", async () => {
    const { callback, deps, fixture } = await login();
    fixture.outage();
    const response = await handleAuth(
      "session",
      request("/api/auth/session", "GET", cookie(callback)),
      deps,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(
      "private-provider-error-marker",
    );
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("revokes the current session on logout, clears cookies and denies replay", async () => {
    const { callback, deps } = await login();
    const oldCookie = cookie(callback);
    const response = await handleAuth(
      "logout",
      request("/api/auth/logout", "POST", oldCookie),
      deps,
    );
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
    expect(
      (
        await handleAuth(
          "session",
          request("/api/auth/session", "GET", oldCookie),
          deps,
        )
      ).status,
    ).toBe(401);
  });

  it("clears local cookies but reports when remote logout cannot be confirmed", async () => {
    const { callback, deps, fixture } = await login();
    fixture.outage();
    const response = await handleAuth(
      "logout",
      request("/api/auth/logout", "POST", cookie(callback)),
      deps,
    );
    expect(response.status).toBe(503);
    expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
  });

  it("uses host-only HttpOnly local cookies without Secure only on loopback HTTP", async () => {
    const local = { ...config, appOrigin: "http://localhost:3000" };
    const response = await handleAuth(
      "start",
      new Request("http://localhost:3000/api/auth/start", {
        method: "POST",
        headers: { Origin: local.appOrigin },
      }),
      { config: local, fetcher: authProviderFixture().fetcher },
    );
    const value = response.headers.getSetCookie().join(";");
    expect(response.status).toBe(303);
    expect(value).toContain("mindmora-pending=");
    expect(value).toContain("HttpOnly");
    expect(value).not.toContain("Secure");
    expect(value).not.toContain("__Host-");
  });

  it("logs out only the current session, preserving a second device session", async () => {
    const fixture = authProviderFixture();
    const first = await login(fixture);
    const second = await login(fixture);
    expect(
      (
        await handleAuth(
          "logout",
          request("/api/auth/logout", "POST", cookie(first.callback)),
          first.deps,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await handleAuth(
          "session",
          request("/api/auth/session", "GET", cookie(first.callback)),
          first.deps,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await handleAuth(
          "session",
          request("/api/auth/session", "GET", cookie(second.callback)),
          second.deps,
        )
      ).status,
    ).toBe(200);
    expect(fixture.calls).toContain("/auth/v1/logout?scope=local");
  });

  it("rejects duplicate and oversized session cookies before provider work", async () => {
    const { callback, deps, fixture } = await login();
    const before = fixture.calls.length;
    for (const raw of [
      `${cookie(callback)}; ${cookie(callback)}`,
      `__Host-mindmora-session=${"x".repeat(4000)}`,
    ])
      expect(
        (
          await handleAuth(
            "session",
            request("/api/auth/session", "GET", raw),
            deps,
          )
        ).status,
      ).toBe(401);
    expect(fixture.calls.length).toBe(before);
  });

  it.each(["malformed", "throw"] as const)(
    "sanitizes %s provider failures without logging credential markers",
    async (failure) => {
      const { callback } = await login();
      const output: unknown[][] = [];
      const errorLog = vi
        .spyOn(console, "error")
        .mockImplementation((...items: unknown[]) => {
          output.push(items);
        });
      const warnLog = vi
        .spyOn(console, "warn")
        .mockImplementation((...items: unknown[]) => {
          output.push(items);
        });
      try {
        const fetcher: typeof fetch = async () => {
          if (failure === "throw") throw new Error("private-transport-marker");
          return new Response("private-malformed-marker", { status: 200 });
        };
        const response = await handleAuth(
          "session",
          request("/api/auth/session", "GET", cookie(callback)),
          { config, fetcher },
        );
        expect(response.status).toBe(503);
        expect(await response.text()).not.toContain("private-");
        expect(JSON.stringify(output)).not.toContain("private-");
      } finally {
        errorLog.mockRestore();
        warnLog.mockRestore();
      }
    },
  );

  it("concurrent refreshes succeed and late refreshed cookies cannot authenticate after logout", async () => {
    const { callback, deps } = await login();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 3_700_000);
      const [first, second] = await Promise.all([
        handleAuth(
          "session",
          request("/api/auth/session", "GET", cookie(callback)),
          deps,
        ),
        handleAuth(
          "session",
          request("/api/auth/session", "GET", cookie(callback)),
          deps,
        ),
      ]);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(
        (
          await handleAuth(
            "logout",
            request("/api/auth/logout", "POST", cookie(first)),
            deps,
          )
        ).status,
      ).toBe(204);
      expect(
        (
          await handleAuth(
            "session",
            request("/api/auth/session", "GET", cookie(second)),
            deps,
          )
        ).status,
      ).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });
});
