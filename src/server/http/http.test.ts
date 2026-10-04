// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
import { assertOrigin } from "./csrf";
import { readJson, readBoundedBody, assertRequestBounds } from "./body";
import { errorResponse } from "./responses";
import { HttpFailure } from "./errors";
const id = "11111111-1111-4111-8111-111111111111";
describe("HTTP security", () => {
  it("hides raw errors and supplies no-store plus retry guidance", async () => {
    const result = errorResponse(new Error("private-error-marker"), id);
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain("private-error-marker");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(result.headers.get("x-request-id")).toBe(id);
    expect(
      errorResponse(new HttpFailure("rate_limited", 1.2), id).headers.get(
        "retry-after",
      ),
    ).toBe("2");
  });
  it.each([null, "null", "https://evil.example", "https://app.example.evil"])(
    "rejects mutation origin %s",
    (origin) => {
      const req = new Request("https://app.example", {
        method: "POST",
        headers: origin ? { Origin: origin } : {},
      });
      expect(() => assertOrigin(req, "https://app.example", true)).toThrow(
        HttpFailure,
      );
    },
  );
  it("rejects cross-site GET and accepts same-origin mutation", () => {
    expect(() =>
      assertOrigin(
        new Request("https://app.example", {
          headers: { "Sec-Fetch-Site": "cross-site" },
        }),
        "https://app.example",
        false,
      ),
    ).toThrow(HttpFailure);
    expect(() =>
      assertOrigin(
        new Request("https://app.example", {
          method: "POST",
          headers: { Origin: "https://app.example" },
        }),
        "https://app.example",
        true,
      ),
    ).not.toThrow();
  });
  it("bounds streamed bytes even with a forged smaller length", async () => {
    const request = new Request("https://app.example", {
      method: "POST",
      body: "12345",
      headers: { "Content-Length": "1" },
    });
    await expect(readBoundedBody(request, 4)).rejects.toMatchObject({
      status: 413,
    });
  });
  it("rejects malformed JSON, fields, MIME and invalid UTF-8 without leaking input", async () => {
    const schema = z.object({ value: z.string() }).strict();
    for (const body of [
      "{private-marker",
      '{"value":3}',
      '{"value":"ok","owner":"private-marker"}',
    ]) {
      await expect(
        readJson(
          new Request("https://app.example", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          }),
          schema,
        ),
      ).rejects.toMatchObject({ code: "invalid_request" });
    }
    await expect(
      readJson(
        new Request("https://app.example", { method: "POST", body: "{}" }),
        schema,
      ),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readJson(
        new Request("https://app.example", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: new Uint8Array([255]),
        }),
        schema,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("returns validated JSON and rejects oversized headers", async () => {
    const req = new Request("https://app.example", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: '{"value":"ok"}',
    });
    expect(
      await readJson(req, z.object({ value: z.string() }).strict()),
    ).toEqual({ value: "ok" });
    expect(() =>
      assertRequestBounds(
        new Request("https://app.example", {
          headers: { cookie: "x".repeat(33000) },
        }),
      ),
    ).toThrow(HttpFailure);
  });
  it("cancels a stalled body at the deadline", async () => {
    const cancel = vi.fn();
    const req = new Request("https://app.example", {
      method: "POST",
      body: new ReadableStream({ cancel }),
      duplex: "half",
    } as RequestInit);
    await expect(readBoundedBody(req, 4, 10)).rejects.toMatchObject({
      status: 400,
    });
    expect(cancel).toHaveBeenCalled();
  });
});

it("does not serialize a modified exception message or arbitrary retry value", async () => {
  const error = new HttpFailure("unauthenticated");
  error.message = "private-exception-marker";
  expect(await errorResponse(error, id).text()).not.toContain("private-");
  expect(
    errorResponse(new HttpFailure("rate_limited", Number.NaN), id).headers.get(
      "retry-after",
    ),
  ).toBeNull();
});
