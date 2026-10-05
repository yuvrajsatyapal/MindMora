"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Alert,
  Skeleton,
} from "../../../components/ui/primitives";
import { SyncStatus } from "../../../components/mindmora";
import { useUiStore } from "../../../stores/ui-store";
import { createNotesApi, type NoteScope } from "../api";
import { noteKeys, useNote, useNotes } from "../hooks";
import { useNoteSelection } from "../use-note-selection";
import { NoteList } from "./NoteList";
import { NoteEditor } from "./NoteEditor";
import type { Note } from "../types";
import { ApiError } from "../../../lib/api/client";
export function NotesWorkspace({
  scope,
  dirtyRef,
}: {
  scope: NoteScope;
  dirtyRef: React.RefObject<boolean>;
}) {
  const api = useMemo(() => createNotesApi(scope), [scope]);
  const query = useQueryClient();
  const selection = useNoteSelection();
  const {
    id: requestedId,
    invalid: requestedInvalid,
    select: selectUrl,
  } = selection;
  // This snapshot is a temporary editor lease while URL navigation is confirmed.
  // nuqs remains the canonical selection; it is restored when navigation is declined.
  const [editorSelection, setEditorSelection] = useState({
    id: selection.id,
    invalid: selection.invalid,
  });
  const [dirty, setDirty] = useState(false);
  const list = useNotes(scope, api);
  const detail = useNote(scope, api, editorSelection.id);
  const unavailable =
    detail.error instanceof ApiError && detail.error.code === "not_found";
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const [editorKey, setEditorKey] = useState(0);
  const onDirty = useCallback(
    (dirty: boolean) => {
      dirtyRef.current = dirty;
      setDirty(dirty);
    },
    [dirtyRef],
  );
  const discard = () =>
    !dirtyRef.current || window.confirm("Discard unsaved changes in this tab?");
  async function select(id: string | null) {
    if (!discard()) return;
    dirtyRef.current = false;
    setDirty(false);
    setEditorKey((value) => value + 1);
    await selection.select(id);
  }
  const onSaved = (note: Note) => {
    scope.assertActive();
    dirtyRef.current = false;
    setDirty(false);
    query.setQueryData([...noteKeys(scope), "detail", note.id], note);
    void query.invalidateQueries({ queryKey: [...noteKeys(scope), "list"] });
    if (!selection.id) void selection.select(note.id);
  };
  const onDeleted = () => {
    scope.assertActive();
    dirtyRef.current = false;
    setDirty(false);
    query.removeQueries({
      queryKey: [...noteKeys(scope), "detail", selection.id],
    });
    void query.invalidateQueries({ queryKey: [...noteKeys(scope), "list"] });
    void selection.select(null);
  };
  useEffect(() => {
    if (
      requestedId === editorSelection.id &&
      requestedInvalid === editorSelection.invalid
    )
      return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      if (
        dirtyRef.current &&
        !window.confirm("Discard unsaved changes in this tab?")
      ) {
        await selectUrl(editorSelection.id);
      } else {
        dirtyRef.current = false;
        setDirty(false);
        setEditorSelection({ id: requestedId, invalid: requestedInvalid });
        setEditorKey((value) => value + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [requestedId, requestedInvalid, selectUrl, editorSelection, dirtyRef]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirtyRef]);
  return (
    <div className="mm-notes-layout">
      <div className="mm-workspace-actions mm-notes-toolbar">
        <Button
          variant="secondary"
          aria-expanded={sidebarOpen}
          aria-controls="workspace-note-list"
          onClick={toggleSidebar}
        >
          Toggle note list
        </Button>
        <Button onClick={() => void select(null)}>New note</Button>
        <Button
          variant="secondary"
          onClick={() => {
            void list.refetch();
            if (editorSelection.id) void detail.refetch();
          }}
        >
          Refresh notes
        </Button>
        <SyncStatus
          state={
            list.isFetching || detail.isFetching
              ? "syncing"
              : list.isError || detail.isError
                ? "error"
                : "synced"
          }
        />
      </div>
      <div className="mm-workspace-grid" data-sidebar={sidebarOpen}>
        {sidebarOpen && (
          <aside id="workspace-note-list" className="mm-notes-sidebar" aria-label="Notes">
              <div className="mm-stack">
                <h2>Your notes</h2>
                {list.isPending ? (
                  <Skeleton label="Loading notes" />
                ) : list.isError ? (
                  <Alert title="Notes unavailable" tone="danger" urgent>
                    Refresh notes to retry.
                  </Alert>
                ) : (
                  <NoteList
                    notes={[
                      ...new Map(
                        list.data.pages
                          .flatMap((page) => page.items)
                          .map((note) => [note.id, note]),
                      ).values(),
                    ]}
                    selectedId={selection.id}
                    select={(id) => void select(id)}
                  />
                )}{" "}
                {list.hasNextPage && (
                  <Button
                    variant="secondary"
                    loading={list.isFetchingNextPage}
                    onClick={() => void list.fetchNextPage()}
                  >
                    Load more notes
                  </Button>
                )}
              </div>
          </aside>
        )}
        <div className="mm-document-surface">
          {editorSelection.invalid ? (
            <Alert title="Invalid note selection" tone="danger">
              Choose a note from the list or create a new note.
            </Alert>
          ) : editorSelection.id && detail.isPending ? (
            <Skeleton label="Loading note" />
          ) : editorSelection.id &&
            detail.isError &&
            (!detail.data || (unavailable && !dirty)) ? (
            <Alert title="Note unavailable" tone="danger" urgent>
              This note may be deleted or inaccessible. Your account cannot
              access it.
            </Alert>
          ) : (
            <NoteEditor
              key={`${editorSelection.id ?? "new"}:${editorKey}`}
              note={editorSelection.id ? (detail.data ?? null) : null}
              unavailable={unavailable}
              api={api}
              onSaved={onSaved}
              onDeleted={onDeleted}
              onDirty={onDirty}
            />
          )}
        </div>
      </div>
    </div>
  );
}
