import { sessionProjectionSchema, type SessionProjection } from "./types";

export async function readSession(
  signal?: AbortSignal,
): Promise<SessionProjection | null> {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error();
    return sessionProjectionSchema.parse(await response.json());
  } catch {
    throw new Error("Authentication request failed.");
  }
}

export async function logout(): Promise<void> {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
    if (response.status !== 204) throw new Error();
  } catch {
    throw new Error("Authentication request failed.");
  }
}
