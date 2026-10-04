// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import * as providers from "../auth/provider";
import { verifyDatabaseSession, assertVerifiedOwner } from "./user-context";
import { authProviderFixture } from "../../tests/auth-provider-fixture";
afterEach(() => vi.restoreAllMocks());
it.each([false, true])(
  "disposes the request-owned real provider after verification (revoked=%s)",
  async (revoked) => {
    const fixture = authProviderFixture();
    const token = fixture.issue();
    if (revoked) fixture.revoke();
    const request = new Request("http://localhost:3000", {
      headers: {
        cookie: `mindmora-session=${Buffer.from(JSON.stringify({ accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: token.expires_at })).toString("base64url")}`,
      },
    });
    const original = providers.createAuthProvider;
    const disposals: ReturnType<typeof vi.spyOn>[] = [];
    vi.spyOn(providers, "createAuthProvider").mockImplementation((...args) => {
      const provider = original(...args);
      disposals.push(vi.spyOn(provider, "dispose"));
      return provider;
    });
    const operation = verifyDatabaseSession(request, {
      config: {
        appOrigin: "http://localhost:3000",
        supabaseUrl: "https://fixture.supabase.co",
        publishableKey: "sb_publishable_fixture",
      },
      fetcher: fixture.fetcher,
    });
    if (revoked)
      await expect(operation).rejects.toThrow("Authentication required.");
    else {
      const result = await operation;
      expect(() => assertVerifiedOwner(result.owner)).not.toThrow();
    }
    expect(disposals).toHaveLength(1);
    expect(disposals[0]).toHaveBeenCalledOnce();
  },
);
