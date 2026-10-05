import { readFile, writeFile, readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { z } from "zod";
// The project uses bundler-style extensionless TS imports. Limit fallback to local TS.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        error.code === "ERR_MODULE_NOT_FOUND" &&
        specifier.startsWith(".") &&
        !specifier.endsWith(".ts")
      )
        return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = JSON.parse(
  await readFile(resolve(root, "docs/api/operation-metadata.json"), "utf8"),
);
const validation = await import("../src/features/notes/validation.ts");
const types = await import("../src/features/notes/types.ts");
const account = await import("../src/features/account/types.ts");
const generatedSchemas = {
  SessionProjection: account.sessionProjectionSchema,
  Note: types.noteSchema,
  NoteSummary: types.noteSummarySchema,
  NoteCursor: validation.noteCursorSchema,
  NotePage: types.notePageSchema,
  CreateNote: validation.createNoteSchema,
  UpdateNote: validation.updateNoteSchema,
  DeleteNote: validation.deleteNoteSchema,
};
// Semantic methods come from the real facade's admission rules, not exported 405 wrappers.
const authSource = await readFile(
  resolve(root, "src/server/auth/routes.ts"),
  "utf8",
);
const notesSource = await readFile(
  resolve(root, "src/server/notes/routes.ts"),
  "utf8",
);
const expected = {
  "/api/auth/start": ["post"],
  "/api/auth/callback": ["get"],
  "/api/auth/session": ["get"],
  "/api/auth/logout": ["post"],
  "/api/notes": ["get", "post"],
  "/api/notes/{id}": ["get", "patch", "delete"],
};
export function validateContract(document) {
  if (
    !authSource.includes('action === "start" || action === "logout"') ||
    !authSource.includes('mutation ? "POST" : "GET"') ||
    !notesSource.includes('id ? "GET, PATCH, DELETE" : "GET, POST"')
  )
    throw new Error(
      "Real method admission changed: review contract route map.",
    );
  if (
    JSON.stringify(Object.keys(document.paths).sort()) !==
    JSON.stringify(Object.keys(expected).sort())
  )
    throw new Error("Contract paths differ from implemented routes.");
  for (const [path, methods] of Object.entries(expected)) {
    if (
      JSON.stringify(Object.keys(document.paths[path]).sort()) !==
      JSON.stringify([...methods].sort())
    )
      throw new Error(`Contract method mismatch: ${path}`);
  }
  function walk(value) {
    if (!value || typeof value !== "object") return;
    if (value.$ref) {
      if (!value.$ref.startsWith("#/"))
        throw new Error("External reference is prohibited.");
      let target = document;
      for (const part of value.$ref.slice(2).split("/"))
        target = target?.[part.replaceAll("~1", "/").replaceAll("~0", "~")];
      if (!target) throw new Error(`Broken contract reference: ${value.$ref}`);
    }
    for (const child of Object.values(value)) walk(child);
  }
  walk(document);
}
export async function generateDocuments() {
  const openapi = structuredClone(input);
  for (const [name, schema] of Object.entries(generatedSchemas)) {
    const { $schema: ignored, ...jsonSchema } = z.toJSONSchema(schema, {
      io: "input",
    });
    void ignored;
    openapi.components.schemas[name] = jsonSchema;
  }
  // JSON Schema cannot express Unicode code-point or UTF-8 byte refinements.
  for (const schema of Object.values(openapi.components.schemas)) {
    if (schema.properties?.title)
      schema.properties.title.description =
        "Trimmed nonempty text; at most 200 Unicode code points; NUL rejected. Enforced by shared Zod refinement.";
    if (schema.properties?.content)
      schema.properties.content.description =
        "At most 1,048,576 UTF-8 bytes; NUL rejected. Enforced by shared Zod refinement.";
  }
  openapi.components.schemas.UpdateNote.anyOf = [
    { required: ["title"] },
    { required: ["content"] },
  ];
  validateContract(openapi);
  // Prove each declared route still has a concrete App Router facade.
  for (const path of Object.keys(expected)) {
    const file = `src/app${path.replace("{id}", "[id]")}/route.ts`;
    const source = await readFile(resolve(root, file), "utf8");
    for (const method of expected[path])
      if (!source.includes(`handler as ${method.toUpperCase()}`))
        throw new Error(`Actual route missing method: ${file} ${method}`);
  }
  const actualPaths = [];
  async function scan(directory) {
    for (const entry of await readdir(resolve(root, directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await scan(path);
      else if (entry.name === "route.ts")
        actualPaths.push(
          path
            .replace("src/app", "")
            .replace("/route.ts", "")
            .replace("[id]", "{id}"),
        );
    }
  }
  await scan("src/app/api");
  if (
    JSON.stringify(actualPaths.sort()) !==
    JSON.stringify(Object.keys(expected).sort())
  )
    throw new Error("Actual API route inventory differs from contract paths.");
  const item = [];
  for (const [path, operations] of Object.entries(openapi.paths))
    for (const [method, operation] of Object.entries(operations)) {
      const header = [{ key: "Accept", value: "application/json" }];
      if (["post", "patch", "delete"].includes(method))
        header.push({ key: "Origin", value: "{{baseUrl}}" });
      let body;
      if (operation.requestBody) {
        header.push({ key: "Content-Type", value: "application/json" });
        if (method === "post")
          header.push({ key: "Idempotency-Key", value: "{{createKey}}" });
        const payload =
          method === "post"
            ? { title: "Disposable API smoke", content: "" }
            : method === "patch"
              ? { title: "Disposable API smoke updated", expectedRevision: 1 }
              : { expectedRevision: 2 };
        body = {
          mode: "raw",
          raw: JSON.stringify(payload, null, 2),
          options: { raw: { language: "json" } },
        };
      }
      const query = path.endsWith("/callback")
        ? "?code={{callbackCode}}&state={{callbackState}}"
        : "";
      item.push({
        name: operation.operationId,
        request: {
          method: method.toUpperCase(),
          header,
          url: `{{baseUrl}}${path.replace("{id}", "{{noteId}}")}/${query}`,
          ...(body ? { body } : {}),
        },
        event: [
          {
            listen: "test",
            script: {
              type: "text/javascript",
              exec: [
                `pm.test("documented response status", () => pm.expect([${Object.keys(operation.responses).join(",")}]).to.include(pm.response.code));`,
                'pm.test("private response is not cached", () => pm.expect(pm.response.headers.get("Cache-Control")).to.include("no-store"));',
              ],
            },
          },
        ],
      });
    }
  const collection = {
    info: {
      name: "MindMora Phase 1",
      description:
        "Disposable data only. Establish Google sign-in in the app. Keep cookies solely in a local Postman cookie jar; never export credentials. Callback placeholders are informational and cannot start a reusable session.",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: "http://localhost:3000" },
      { key: "noteId", value: "00000000-0000-4000-8000-000000000001" },
      { key: "createKey", value: "00000000-0000-4000-8000-000000000002" },
      { key: "callbackCode", value: "" },
      { key: "callbackState", value: "" },
    ],
    item,
  };
  return { openapi, collection };
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const documents = await generateDocuments();
  for (const [name, document] of [
    ["openapi.json", documents.openapi],
    ["mindmora.postman_collection.json", documents.collection],
  ]) {
    const path = resolve(root, "docs/api", name);
    const output = JSON.stringify(document, null, 2) + "\n";
    if (process.argv.includes("--check")) {
      if ((await readFile(path, "utf8")) !== output)
        throw new Error(`Generated API contract drift: ${name}`);
    } else await writeFile(path, output);
  }
  console.log(
    process.argv.includes("--check")
      ? "PASS generated API contract and collection drift"
      : "Generated OpenAPI and Postman collection",
  );
}
