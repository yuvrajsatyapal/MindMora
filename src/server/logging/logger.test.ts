// @vitest-environment node
import { it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createRequestLogger } from "./logger";
it("retains operational metadata and removes arbitrary nested private markers", () => {
  let output = "";
  const log = createRequestLogger({
    write: (chunk) => {
      output += chunk;
    },
  });
  log({
    correlationId: "11111111-1111-4111-8111-111111111111",
    operation: "auth.session",
    status: 503,
    durationMs: 4,
    errorCode: "auth_unavailable",
    req: { headers: { cookie: "private-cookie-marker" } },
    error: new Error("private-error-marker"),
    nested: { title: "private-note-marker" },
    url: "https://example.test/?signature=private-signed-marker",
    accessToken: "private-token-marker",
  });
  expect(output).not.toContain("private-");
  expect(JSON.parse(output)).toMatchObject({
    operation: "auth.session",
    status: 503,
    errorCode: "auth_unavailable",
  });
  log({
    correlationId: "private-id-marker",
    operation: "private-op-marker",
    status: 200,
    durationMs: 1,
  });
  expect(output).not.toContain("private-");
});
it("logs knowledge operation metadata while excluding terms, tags and snippets", () => {
 let output="";const log=createRequestLogger({write:chunk=>{output+=chunk;}});
 log({correlationId:"11111111-1111-4111-8111-111111111111",operation:"knowledge.search",status:200,durationMs:1,query:"private-query",tag:"private-tag",snippet:"private-snippet",targets:["private-title"]});
 expect(JSON.parse(output).operation).toBe("knowledge.search");expect(output).not.toContain("private-");
});
