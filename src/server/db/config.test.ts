import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDatabaseConfig } from "./config";
it("keeps malformed URL credential errors input-free", () => {
  expect(() =>
    getDatabaseConfig({
      DATABASE_URL: "postgresql://%ZZ:private-marker@localhost/db",
    }),
  ).toThrow("Invalid server configuration: database.");
});
it("requires the constrained runtime login and bounds its pool", () => {
  expect(() =>
    getDatabaseConfig({
      DATABASE_URL: "postgresql://postgres:secret@localhost/db",
    }),
  ).toThrow("Invalid server configuration: database.");
  expect(() =>
    getDatabaseConfig({
      DATABASE_URL: "postgresql://mindmora_app:secret@localhost/db",
      DATABASE_POOL_MAX: "100",
    }),
  ).toThrow();
  expect(
    getDatabaseConfig({
      DATABASE_URL: "postgresql://mindmora_app:secret@localhost/db",
    }),
  ).toMatchObject({ max: 3, ssl: false });
  expect(
    getDatabaseConfig({
      DATABASE_URL: "postgresql://mindmora_app.project:secret@db.example/db",
    }),
  ).toMatchObject({ ssl: true });
});
