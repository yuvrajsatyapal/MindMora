"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readSession, logout } from "../../features/account/api";
import type { SessionProjection } from "../../features/account/types";
import { SignInGate } from "../../features/account/components/SignInGate";
import { NotesWorkspace } from "../../features/notes/components/NotesWorkspace";
import type { NoteScope } from "../../features/notes/api";
import { useNoteSelection } from "../../features/notes/use-note-selection";
import { useUiStore } from "../../stores/ui-store";
import { Logo } from "../ui/brand";
import { ThemeSelect } from "../ui/theme";
import { RefreshCw } from "lucide-react";
import { Button, Icon, Skeleton, Alert } from "../ui/primitives";
type Lease = {
  session: SessionProjection;
  generation: number;
  controller: AbortController;
};
export function WorkspaceShell({ nonce,knowledgeEnabled=false }: { nonce?: string;knowledgeEnabled?:boolean } = {}) {
  const [query] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, staleTime: 15_000, gcTime: 300_000 },
          mutations: { retry: false },
        },
      }),
  );
  const [lease, setLease] = useState<Lease | null>(null);
  const [scope, setScope] = useState<NoteScope | null>(null);
  const current = useRef<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const checkId = useRef(0);
  const dirtyRef = useRef(false);
  const signingOut = useRef(false);
  const { select: selectUrl } = useNoteSelection();
  const clear = useCallback(
    (clearSelection = true) => {
      generation.current += 1;
      current.current?.controller.abort();
      current.current = null;
      dirtyRef.current = false;
      void query.cancelQueries();
      query.clear();
      useUiStore.getState().reset();
      setLease(null);
      setScope(null);
      if (clearSelection) void selectUrl(null);
    },
    [query, selectUrl],
  );
  const check = useCallback(async () => {
    if (signingOut.current) return;
    const sequence = ++checkId.current;
    try {
      const session = await readSession();
      if (sequence !== checkId.current || signingOut.current) return;
      if (session?.user.id !== current.current?.session.user.id) {
        const hadIdentity = current.current !== null;
        clear(hadIdentity);
        if (session) {
          const next = {
            session,
            generation: generation.current,
            controller: new AbortController(),
          };
          current.current = next;
          setLease(next);
          setScope({
            ownerId: session.user.id,
            generation: next.generation,
            signal: next.controller.signal,
            invalidate: () => {
              if (current.current === next) clear();
            },
            assertActive: () => {
              if (current.current !== next || next.controller.signal.aborted)
                throw new Error("Session changed.");
            },
            verify: async () => {
              if (current.current !== next) throw new Error("Session changed.");
              const verified = await readSession(next.controller.signal);
              if (current.current !== next) throw new Error("Session changed.");
              if (verified?.user.id !== next.session.user.id) {
                clear();
                setError(
                  "Your session changed. Verify your session to continue.",
                );
                throw new Error("Session changed.");
              }
            },
          });
        }
      }
      setError("");
    } catch {
      if (sequence === checkId.current && !signingOut.current)
        setError("Session verification failed. Retry to access your notes.");
    } finally {
      if (sequence === checkId.current && !signingOut.current)
        setLoading(false);
    }
  }, [clear]);
  useEffect(() => {
    void Promise.resolve().then(check);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => {
      checkId.current += 1;
      current.current?.controller.abort();
      void query.cancelQueries();
      query.clear();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [check, query]);
  async function signOut() {
    if (
      dirtyRef.current &&
      !window.confirm("Sign out and discard unsaved changes in this tab?")
    )
      return;
    signingOut.current = true;
    checkId.current += 1;
    clear();
    setLoading(true);
    try {
      await logout();
      setError("");
    } catch {
      setError(
        "Sign out could not be confirmed. Verify your session before continuing.",
      );
    } finally {
      signingOut.current = false;
      setLoading(false);
    }
  }
  return (
    <main className="mm-workspace">
      <header className="mm-workspace-header">
        <div className="mm-workspace-brand">
          <a href="/" aria-label="MindMora home"><Logo iconOnly /></a>
          <h1>MindMora workspace</h1>
        </div>
        <div className="mm-workspace-account">
          <ThemeSelect />
        {lease && (
          <div className="mm-workspace-actions">
            <span>
              {lease.session.user.displayName ??
                lease.session.user.email ??
                "Signed in"}
            </span>
            <Button variant="secondary" aria-label="Refresh session" onClick={() => void check()}>
              <Icon icon={RefreshCw} size="sm" />
              <span className="mm-refresh-label">Refresh session</span>
            </Button>
            <Button variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        )}
        </div>
      </header>
      {error && (
        <div className="mm-stack">
          <Alert title="Session needs attention" tone="danger" urgent>
            {error}
          </Alert>
          <Button onClick={() => void check()}>Retry session</Button>
        </div>
      )}
      {loading ? (
        <Skeleton label="Verifying session" />
      ) : lease && scope ? (
        <QueryClientProvider client={query}>
          <NotesWorkspace
            key={`${scope.ownerId}:${scope.generation}`}
            scope={scope}
            nonce={nonce}
            knowledgeEnabled={knowledgeEnabled}
            dirtyRef={dirtyRef}
          />
        </QueryClientProvider>
      ) : (
        !error && <SignInGate />
      )}
    </main>
  );
}
