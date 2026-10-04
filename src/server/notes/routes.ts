import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createNoteSchema,
  updateNoteSchema,
  deleteNoteSchema,
  listNotesSchema,
} from "../../features/notes/validation";
import { getAuthConfig, type AuthConfig } from "../config";
import { AuthFailure } from "../auth/provider";
import { clearSession, writeCookie } from "../auth/session";
import { verifyDatabaseSession, type VerifiedOwner } from "../db/user-context";
import { DatabaseFailure } from "../db/client";
import { assertOrigin } from "../http/csrf";
import { assertRequestBounds, readBoundedBody, readJson } from "../http/body";
import { HttpFailure } from "../http/errors";
import {
  errorResponse,
  privateResponse,
  responseErrorCode,
} from "../http/responses";
import { logRequest } from "../logging/logger";
import { limiter } from "../rate-limit/limiter";
import {
  createNoteRepository,
  type NoteRepository,
  type NoteDatabase,
} from "./repository";
import { createNoteService, profileName } from "./service";
export type NotesDependencies = {
  config?: AuthConfig;
  fetcher?: typeof fetch;
  database?: NoteDatabase;
  repository?: NoteRepository;
  admission?: (owner: VerifiedOwner) => Promise<{ degraded: boolean }>;
  logger?: typeof logRequest;
};
function listInput(request: Request) {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some(
      (key) =>
        !["limit", "cursor"].includes(key) || params.getAll(key).length !== 1,
    )
  )
    throw new HttpFailure("invalid_request");
  let cursor: unknown;
  try {
    if (params.has("cursor")) cursor = JSON.parse(params.get("cursor")!);
  } catch {
    throw new HttpFailure("invalid_request");
  }
  return listNotesSchema.parse({
    ...(params.has("limit") ? { limit: params.get("limit") } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
  });
}
export async function handleNotes(
  request: Request,
  id?: string,
  dependencies: NotesDependencies = {},
): Promise<Response> {
  const correlationId = randomUUID();
  const started = performance.now();
  const action = id
    ? request.method === "GET"
      ? "detail"
      : request.method === "PATCH"
        ? "update"
        : request.method === "DELETE"
          ? "delete"
          : "unsupported"
    : request.method === "GET"
      ? "list"
      : request.method === "POST"
        ? "create"
        : "unsupported";
  let config: AuthConfig | undefined,
    verified: Awaited<ReturnType<typeof verifyDatabaseSession>> | undefined;
  let degraded = false;
  let result: NextResponse;
  try {
    assertRequestBounds(request);
    try {
      config = dependencies.config ?? getAuthConfig();
    } catch {
      throw new HttpFailure("auth_unavailable");
    }
    if (action === "unsupported") throw new HttpFailure("method_not_allowed");
    assertOrigin(request, config.appOrigin, request.method !== "GET");
    verified = await verifyDatabaseSession(request, {
      config,
      fetcher: dependencies.fetcher,
    });
    degraded = (await (dependencies.admission ?? limiter.basic)(verified.owner))
      .degraded;
    if (id) z.uuid().parse(id);
    if (action !== "list" && new URL(request.url).search)
      throw new HttpFailure("invalid_request");
    const owner = verified.owner,
      name = profileName(verified.projection.user.displayName);
    // Validate inputs before constructing a pool or doing profile/note SQL.
    const parsed = await (async () => {
      switch (action) {
        case "list":
          if ((await readBoundedBody(request, 1024)).byteLength)
            throw new HttpFailure("invalid_request");
          return { action, input: listInput(request) } as const;
        case "create":
          return {
            action,
            input: await readJson(request, createNoteSchema),
            key: z.uuid().parse(request.headers.get("Idempotency-Key")),
          } as const;
        case "update":
          return {
            action,
            input: await readJson(request, updateNoteSchema),
          } as const;
        case "delete":
          return {
            action,
            input: await readJson(request, deleteNoteSchema),
          } as const;
        case "detail":
          if ((await readBoundedBody(request, 1024)).byteLength)
            throw new HttpFailure("invalid_request");
          return { action } as const;
      }
    })();
    const service = createNoteService(
      dependencies.repository ?? createNoteRepository(dependencies.database),
    );
    switch (parsed.action) {
      case "list":
        result = NextResponse.json(
          await service.list(owner, name, parsed.input),
        );
        break;
      case "create": {
        const created = await service.create(
          owner,
          name,
          parsed.input,
          parsed.key,
        );
        result = NextResponse.json(created.note, {
          status: created.created ? 201 : 200,
        });
        break;
      }
      case "detail":
        result = NextResponse.json(await service.detail(owner, name, id!));
        break;
      case "update":
        result = NextResponse.json(
          await service.update(owner, name, id!, parsed.input),
        );
        break;
      case "delete":
        result = NextResponse.json(
          await service.remove(owner, name, id!, parsed.input),
        );
        break;
    }
  } catch (error) {
    const safe =
      error instanceof z.ZodError
        ? new HttpFailure("invalid_request")
        : error instanceof AuthFailure
          ? new HttpFailure(
              error.kind === "unauthenticated"
                ? "unauthenticated"
                : "auth_unavailable",
            )
          : error instanceof DatabaseFailure
            ? new HttpFailure("service_unavailable")
            : error;
    result = errorResponse(safe, correlationId);
    if (
      error instanceof AuthFailure &&
      error.kind === "unauthenticated" &&
      config
    )
      clearSession(result, config.appOrigin);
  }
  privateResponse(result, correlationId);
  if (result.status === 405)
    result.headers.set("Allow", id ? "GET, PATCH, DELETE" : "GET, POST");
  if (degraded) result.headers.set("X-RateLimit-Degraded", "true");
  if (verified?.refreshed && config)
    writeCookie(
      result,
      config.appOrigin,
      "session",
      verified.tokens,
      60 * 60 * 24 * 7,
    );
  (dependencies.logger ?? logRequest)({
    correlationId,
    operation: `notes.${action}`,
    status: result.status,
    errorCode: responseErrorCode(result),
    durationMs: Math.max(0, performance.now() - started),
  });
  return result;
}
