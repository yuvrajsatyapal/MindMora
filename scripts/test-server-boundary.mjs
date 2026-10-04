import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const next = path.join(root, "node_modules/next/dist/bin/next");
const fixture = await mkdtemp(path.join(tmpdir(), "mindmora-boundary-"));
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  APP_ORIGIN: "https://runtime.example",
};
let server;

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [next, "build", "--webpack"], {
      cwd: fixture,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

try {
  await mkdir(path.join(fixture, "src/app"), { recursive: true });
  await mkdir(path.join(fixture, "src/server"), { recursive: true });
  await symlink(
    path.join(root, "node_modules"),
    path.join(fixture, "node_modules"),
    "dir",
  );
  await copyFile(
    path.join(root, "src/server/config.ts"),
    path.join(fixture, "src/server/config.ts"),
  );
  await mkdir(path.join(fixture, "src/server/db"), { recursive: true });
  await copyFile(
    path.join(root, "src/server/db/config.ts"),
    path.join(fixture, "src/server/db/config.ts"),
  );
  const pkg = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  await writeFile(
    path.join(fixture, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: pkg.dependencies,
    }),
  );
  await copyFile(
    path.join(root, "tsconfig.json"),
    path.join(fixture, "tsconfig.json"),
  );
  await copyFile(
    path.join(root, "next.config.ts"),
    path.join(fixture, "next.config.ts"),
  );
  await writeFile(
    path.join(fixture, "src/app/layout.tsx"),
    "export default function Layout({children}: {children: React.ReactNode}) { return <html><body>{children}</body></html>; }",
  );
  await writeFile(
    path.join(fixture, "src/app/page.tsx"),
    '"use client"; import {getServerConfig} from "../server/config"; export default function Page() { return <p>{getServerConfig({APP_ORIGIN: "https://example.test"}).appOrigin}</p>; }',
  );

  const client = await runBuild();
  assert.notEqual(
    client.code,
    0,
    "Client import of server configuration must fail the build",
  );
  assert.match(
    client.output,
    /server-only/,
    "Build must fail on the server-only import, not missing tooling",
  );
  assert.match(
    client.output,
    /only available in Server Components/,
    "Build must identify the server restriction",
  );
  assert.match(
    client.output,
    /src\/app\/page\.tsx/,
    "Build must trace the importing client page",
  );
  console.log("PASS: Next rejects Client Component import of server config");

  await writeFile(
    path.join(fixture, "src/app/page.tsx"),
    '"use client"; import {getDatabaseConfig} from "../server/db/config"; export default function Page() { return <p>{getDatabaseConfig().max}</p>; }',
  );
  const databaseClient = await runBuild();
  assert.notEqual(
    databaseClient.code,
    0,
    "Client database config import must fail",
  );
  assert.match(databaseClient.output, /server-only/);
  assert.match(databaseClient.output, /only available in Server Components/);
  console.log("PASS: Next rejects Client Component import of database config");

  await writeFile(
    path.join(fixture, "src/app/page.tsx"),
    "export default function Page() { return <p>Public runtime fixture</p>; }",
  );
  await mkdir(path.join(fixture, "src/app/api/runtime"), { recursive: true });
  await writeFile(
    path.join(fixture, "src/app/api/runtime/route.ts"),
    `
    import {getServerConfig} from "../../../server/config";
    export const runtime = "nodejs";
    export const dynamic = "force-dynamic";
    export function GET(request: Request) {
      return Response.json({runtime: process.release.name, origin: getServerConfig().appOrigin,
        nonce: new URL(request.url).searchParams.get("nonce")}, {headers: {"Cache-Control": "no-store"}});
    }
  `,
  );
  const positive = await runBuild();
  assert.equal(
    positive.code,
    0,
    `Server config and Node route must build:\n${positive.output}`,
  );

  const portProbe = createServer();
  portProbe.listen(0, "127.0.0.1");
  await once(portProbe, "listening");
  const address = portProbe.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolve) => portProbe.close(resolve));
  // Change config after build to prove it is read at request time, not baked into output.
  server = spawn(
    process.execPath,
    [next, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: fixture,
      env: { ...env, APP_ORIGIN: "https://request-time.example" },
      stdio: "ignore",
    },
  );
  server.on("error", (error) => {
    console.error(error.message);
  });
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (true) {
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {
      /* Wait for the disposable server to start. */
    }
    assert.ok(
      Date.now() < deadline,
      "Fixture server must start within 30 seconds",
    );
    assert.equal(
      server.exitCode,
      null,
      "Fixture server exited before becoming ready",
    );
    await setTimeout(100);
  }
  for (const nonce of ["first", "second"]) {
    const response = await fetch(`${base}/api/runtime?nonce=${nonce}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      runtime: "node",
      origin: "https://request-time.example",
      nonce,
    });
  }
  console.log(
    "PASS: server-only config builds and a Node Route Handler reads request-time configuration",
  );
} finally {
  if (server && server.exitCode === null) {
    const closed = once(server, "close");
    server.kill("SIGTERM");
    await closed;
  }
  await rm(fixture, { recursive: true, force: true });
}
