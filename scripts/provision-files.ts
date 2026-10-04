import { open, readFile, rename } from "node:fs/promises";
/** Persist before SQL: interruption leaves recoverable credentials, never a lost password. */
export async function stageCredentialFile(
  path: string,
  original: string,
  next: string,
) {
  const pending = `${path}.database-pending`;
  const file = await open(pending, "wx", 0o600);
  try {
    await file.writeFile(next, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  return {
    publish: async () => {
      if ((await readFile(path, "utf8")) !== original)
        throw new Error("Credential file changed; pending setup retained.");
      await rename(pending, path);
    },
  };
}
