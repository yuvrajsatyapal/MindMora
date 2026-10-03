import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Production Next runtime, bound only to loopback for local review and Playwright.
const root = fileURLToPath(new URL("../", import.meta.url));
const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const child = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", "4173"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(`Runtime preview failed: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
});
