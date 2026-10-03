import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getAuthConfig } from "../config";

it("validates auth configuration lazily and projects only supported fields", () => {
  expect(
    getAuthConfig({
      APP_ORIGIN: "http://localhost:3000",
      SUPABASE_URL: "https://project.supabase.co/",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_disposable",
      SUPABASE_SERVICE_ROLE_KEY: "private-marker",
    }),
  ).toEqual({
    appOrigin: "http://localhost:3000",
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "sb_publishable_disposable",
  });
});
it.each([
  {},
  { SUPABASE_URL: "https://project.supabase.co" },
  {
    SUPABASE_URL: "http://external.example",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  },
  {
    SUPABASE_URL: "https://private-marker@project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  },
  {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_secret_private-marker",
  },
])(
  "rejects missing/unsafe provider config with an input-free error",
  (extra) => {
    expect(() =>
      getAuthConfig({ APP_ORIGIN: "http://localhost:3000", ...extra }),
    ).toThrow("Invalid server configuration: Supabase Auth.");
  },
);
