import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateDocuments, validateContract } from "./generate-api-docs.mjs";
const { openapi, collection } = await generateDocuments();
validateContract(openapi);
const stale = structuredClone(openapi);
stale.paths["/api/notes"].put = stale.paths["/api/notes"].post;
assert.throws(
  () => validateContract(stale),
  /method/i,
  "An unsupported operation must fail drift validation",
);
const missing = structuredClone(openapi);
delete missing.paths["/api/notes"].post;
assert.throws(
  () => validateContract(missing),
  /method/i,
  "A missing real operation must fail drift validation",
);
const broken = structuredClone(openapi);
broken.paths["/api/notes"].get.responses["200"].content[
  "application/json"
].schema.$ref = "#/components/schemas/Missing";
assert.throws(() => validateContract(broken), /reference/i);
assert.equal(openapi.components.schemas.CreateNote.additionalProperties, false);
assert.equal(
  openapi.components.schemas.UpdateNote.properties.expectedRevision.maximum,
  2147483646,
);
assert.equal(
  openapi.components.schemas.NotePage.properties.items.maxItems,
  100,
);
assert.deepEqual(openapi.components.schemas.UpdateNote.anyOf, [
  { required: ["title"] },
  { required: ["content"] },
]);
assert.equal(Object.keys(openapi.paths).length, 10);
assert.ok(openapi.paths["/api/search"]?.post, "Full corpus search must be in the contract");
assert.equal(collection.item.length, 13);
assert.equal(openapi.components.schemas.SearchInput.additionalProperties, false);
assert.equal(openapi.components.schemas.SearchPage.properties.items.maxItems, 100);
assert.equal(openapi.components.schemas.TargetPage.properties.items.maxItems, 50);
const knowledgeMissing = structuredClone(openapi);
delete knowledgeMissing.paths["/api/notes/{id}/backlinks"];
assert.throws(() => validateContract(knowledgeMissing), /paths/i);
const invalidSecurity = structuredClone(openapi);
invalidSecurity.paths["/api/search"].post.security = [{ MissingScheme: [] }];
assert.throws(() => validateContract(invalidSecurity), /security scheme/i);
assert.ok(
  collection.item.every(
    (item) =>
      !item.request.header.some(
        (header) => header.key.toLowerCase() === "cookie",
      ),
  ),
);
const page = await readFile("src/app/dev/api-docs/page.tsx", "utf8");
assert.match(page, /API_DOCS_ENABLED/);
assert.match(page, /notFound/);
console.log(
  "PASS contract generation, route method drift, missing operations, refs, shared schema bounds and secret-free collection",
);
const { runCollectionSmoke } = await import("./test-api-collection.mjs");
let revision = 1;
let createdId;
const requests = [];
const results = await runCollectionSmoke(
  "http://localhost:3000",
  async (url, options) => {
    requests.push({ url, options });
    const payload = options.body && JSON.parse(options.body);
    let status = 200;
    let data = {};
    if (options.method === "POST" && url.endsWith("/api/notes/")) {
      status = 201;
      createdId = "00000000-0000-4000-8000-000000000003";
      data = { id: createdId, revision };
    }
    if (["PATCH", "DELETE"].includes(options.method)) {
      assert.equal(
        payload.expectedRevision,
        revision,
        "Collection smoke advances the committed revision",
      );
      revision += 1;
      data = {
        id: createdId,
        revision,
        ...(options.method === "DELETE"
          ? { deletedAt: "2026-10-05T00:00:00.000Z" }
          : {}),
      };
    }
    return {
      status,
      headers: new Headers({
        "cache-control": "private, no-store",
        "x-request-id": "test",
      }),
      json: async () => data,
    };
  },
  true,
);
assert.equal(results.length, 10);
assert.deepEqual(results.map(result=>result.operation), ["authSession","listNotes","createNote","readNote","wikiTargets","noteBacklinks","listTags","searchNotes","updateNote","softDeleteNote"]);
assert.equal(requests.filter(request => Object.keys(request.options.headers).some(key => key.toLowerCase() === "idempotency-key")).length, 1);
assert.ok(
  requests.filter((request) => ["GET", "PATCH", "DELETE"].includes(request.options.method) && request.url.includes(createdId)).every((request) => request.url.includes(`${createdId}/`)),
);
assert.equal(revision, 3);
console.log(
  "PASS generated collection executor uses created note ID and committed revisions (unit fixture, not live CRUD evidence)",
);
