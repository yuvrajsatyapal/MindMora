import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageCredentialFile } from "../../../scripts/provision-files";
it("stages recoverable credentials without truncating env, then publishes with private permissions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mindmora-provision-"));
  const path = join(directory, ".env");
  const original = "DATABASE_URL=\nAPP_ORIGIN=http://localhost:3000\n";
  const next = original.replace(
    "DATABASE_URL=",
    "DATABASE_URL=fixture-credential",
  );
  try {
    await writeFile(path, original, { mode: 0o644 });
    const stage = await stageCredentialFile(path, original, next);
    expect(await readFile(path, "utf8")).toBe(original);
    expect(await readFile(`${path}.database-pending`, "utf8")).toBe(next);
    expect((await stat(`${path}.database-pending`)).mode & 0o777).toBe(0o600);
    await stage.publish();
    expect(await readFile(path, "utf8")).toBe(next);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it("retains the private pending credential when env changes during provisioning", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mindmora-provision-"));
  const path = join(directory, ".env");
  try {
    await writeFile(path, "before");
    const stage = await stageCredentialFile(path, "before", "credential");
    await writeFile(path, "user-edited");
    await expect(stage.publish()).rejects.toThrow("Credential file changed");
    expect(await readFile(path, "utf8")).toBe("user-edited");
    expect(await readFile(`${path}.database-pending`, "utf8")).toBe(
      "credential",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
