import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const collection = JSON.parse(
  await readFile(
    new URL("../docs/api/mindmora.postman_collection.json", import.meta.url),
    "utf8",
  ),
);
const contract = JSON.parse(
  await readFile(new URL("../docs/api/openapi.json", import.meta.url), "utf8"),
);
/** request uses fetch-compatible options and returns {status,headers.get,json,body?}. */
export async function runCollectionSmoke(
  baseUrl,
  request = fetch,
  authenticated = false,
) {
  const origin = new URL(baseUrl).origin;
  if (
    !["http://localhost:", "http://127.0.0.1:"].some((prefix) =>
      `${origin}:`.startsWith(prefix),
    )
  )
    throw new Error(
      "Collection smoke is restricted to a disposable localhost runtime.",
    );
  const variables = {
    baseUrl: origin,
    noteId: randomUUID(),
    createKey: randomUUID(),
    callbackCode: "",
    callbackState: "",
    revision: 1,
  };
  const fill = (value) =>
    value.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
  const order = [
    "authSession",
    "listNotes",
    "createNote",
    "readNote",
    "updateNote",
    "softDeleteNote",
    ...(authenticated ? [] : ["authCallback", "authStart", "authLogout"]),
  ];
  const results = [];
  for (const name of order) {
    const item = collection.item.find((candidate) => candidate.name === name);
    assert.ok(item, `Collection operation ${name} exists`);
    const headers = Object.fromEntries(
      item.request.header.map(({ key, value }) => [key, fill(value)]),
    );
    const payload = item.request.body
      ? JSON.parse(item.request.body.raw)
      : undefined;
    if (payload?.expectedRevision)
      payload.expectedRevision = variables.revision;
    const response = await request(fill(item.request.url), {
      method: item.request.method,
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      redirect: "manual",
    });
    const operation = Object.values(contract.paths)
      .flatMap(Object.values)
      .find((candidate) => candidate.operationId === name);
    assert.ok(
      operation.responses[String(response.status)],
      `${name} undocumented response status ${response.status}`,
    );
    assert.ok(
      response.headers.get("cache-control")?.includes("no-store"),
      `${name} must not be cached`,
    );
    assert.ok(
      response.headers.get("x-request-id"),
      `${name} correlation header`,
    );
    if (
      authenticated &&
      ["authSession", "listNotes", "readNote", "updateNote"].includes(name)
    )
      assert.equal(response.status, 200, `${name} authenticated success`);
    if (authenticated && name === "createNote") {
      assert.equal(response.status, 201);
      const note = await response.json();
      variables.noteId = note.id;
      variables.revision = note.revision;
      assert.equal(typeof variables.noteId, "string");
    }
    if (authenticated && name === "updateNote")
      variables.revision = (await response.json()).revision;
    if (authenticated && name === "softDeleteNote") {
      assert.equal(response.status, 200);
      assert.ok((await response.json()).deletedAt);
    }
    await response.body?.cancel();
    results.push({ operation: name, status: response.status });
  }
  return results;
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  // Optional local credentials remain in process memory, never printed/written.
  const cookie = process.env.API_SMOKE_COOKIE;
  const request = (url, options) =>
    fetch(url, {
      ...options,
      headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) },
    });
  const results = await runCollectionSmoke(
    process.env.API_SMOKE_BASE_URL ?? "http://localhost:3000",
    request,
    Boolean(cookie),
  );
  for (const result of results)
    console.log(`PASS collection ${result.operation}: ${result.status}`);
  console.log(
    cookie
      ? "PASS disposable authenticated collection CRUD smoke"
      : "PASS unauthenticated collection admission smoke (authenticated CRUD was not requested)",
  );
}
