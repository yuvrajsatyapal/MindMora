import { expect, it } from "vitest";
import { workspacePolicy } from "./content-security-policy";
it("restricts production scripts/resources and permits only style positioning exceptions", () => {
  const policy = workspacePolicy("unpredictable");
  expect(policy).toContain("script-src 'self' 'nonce-unpredictable' 'strict-dynamic'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).toContain("style-src-attr 'unsafe-inline'");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
});
it("allows framework debugging eval only in development", () => {
  expect(workspacePolicy("nonce", true)).toContain("'unsafe-eval'");
});
it("permits only the configured OAuth redirect origin and Google alongside same-origin forms",()=>{
 const policy=workspacePolicy("nonce",false,"https://project.supabase.co");
 expect(policy).toContain("form-action 'self' https://project.supabase.co https://accounts.google.com");
});
