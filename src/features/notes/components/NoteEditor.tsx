"use client";
import { useEffect, useRef, useState } from "react";
import type { Note, CreateNoteInput } from "../types";
import type { NotesApi } from "../api";
import { createNoteSchema } from "../validation";
import { ApiError } from "../../../lib/api/client";
import {
  Button,
  TextField,
  TextArea,
  Alert,
} from "../../../components/ui/primitives";
import { SaveStatus, type SaveState } from "../../../components/mindmora";
export function NoteEditor({
  note,
  api,
  onSaved,
  onDeleted,
  onDirty,
  unavailable = false,
}: {
  note: Note | null;
  api: NotesApi;
  onSaved: (note: Note) => void;
  onDeleted: () => void;
  onDirty: (dirty: boolean) => void;
  unavailable?: boolean;
}) {
  const [base, setBase] = useState(note);
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [state, setState] = useState<SaveState>(note ? "saved" : "unsaved");
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<Note | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{
    input: CreateNoteInput;
    key: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const titleInput = useRef<HTMLElement>(null);
  const mounted = useRef(true);
  const dirty =
    pendingCreate !== null ||
    title !== (base?.title ?? "") ||
    content !== (base?.content ?? "");
  // Adopt a refetched commit only while the editor has no independent draft.
  // Revisions advance monotonically, so stale cache data cannot undo a confirmed save.
  if (
    note &&
    base &&
    note.id === base.id &&
    note.revision > base.revision &&
    !dirty &&
    !busy &&
    !latest &&
    !pendingCreate &&
    !unavailable
  ) {
    setBase(note);
    setTitle(note.title);
    setContent(note.content);
    setState("saved");
    setError("");
  }
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    titleInput.current?.querySelector("input")?.focus();
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function accepted(result: Note) {
    if (!mounted.current) return;
    setBase(result);
    setTitle(result.title);
    setContent(result.content);
    setLatest(null);
    setPendingCreate(null);
    setState("saved");
    setError("");
    onSaved(result);
  }
  async function reconcile(attempt: CreateNoteInput) {
    if (!base) return;
    try {
      const current = await api.read(base.id);
      if (!mounted.current) return;
      if (
        current.title === attempt.title &&
        current.content === attempt.content &&
        current.revision > base.revision
      )
        accepted(current);
      else {
        setLatest(current);
        setError(
          "The server has a different version. Your draft is retained. Choose how to resolve it.",
        );
      }
    } catch {
      if (mounted.current)
        setError(
          "Unable to reconcile the save. Your draft is retained. Check the server before retrying.",
        );
    }
  }
  async function save() {
    const validated = createNoteSchema.safeParse({ title, content });
    if (!validated.success) {
      setError(
        "Use a non-empty title of at most 200 characters and content of at most 1 MiB.",
      );
      setState("error");
      return;
    }
    const attempt = pendingCreate?.input ?? validated.data;
    const operation = pendingCreate ?? {
      input: attempt,
      key: crypto.randomUUID(),
    };
    setBusy(true);
    setState("saving");
    setError("");
    try {
      const result = base
        ? await api.update(base.id, {
            ...attempt,
            expectedRevision: base.revision,
          })
        : await api.create(operation.input, operation.key);
      if (!mounted.current) return;
      if (
        result.title !== attempt.title ||
        result.content !== attempt.content
      ) {
        setBase(result);
        setLatest(result);
        setPendingCreate(null);
        setState("error");
        setError(
          "The committed note has changed since this create operation. Your original draft is retained.",
        );
      } else accepted(result);
    } catch (failure) {
      if (!mounted.current) return;
      setState("error");
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Save failed. Your draft is retained.",
      );
      if (
        !base &&
        (!(failure instanceof ApiError) ||
          failure.code === "uncertain" ||
          failure.status >= 500)
      )
        setPendingCreate(operation);
      if (
        base &&
        failure instanceof ApiError &&
        (failure.code === "revision_conflict" ||
          failure.code === "uncertain" ||
          failure.status >= 500)
      )
        await reconcile(attempt);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function remove() {
    if (
      !base ||
      !window.confirm("Delete this note? Unsaved changes will be discarded.")
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.remove(base.id, base.revision);
      if (mounted.current) onDeleted();
    } catch (failure) {
      if (!mounted.current) return;
      if (
        failure instanceof ApiError &&
        (failure.code === "uncertain" || failure.status >= 500)
      ) {
        try {
          setLatest(await api.read(base.id));
          setError(
            "Delete was not confirmed. The note still exists; review it before retrying.",
          );
        } catch (readFailure) {
          if (
            readFailure instanceof ApiError &&
            readFailure.code === "not_found"
          )
            onDeleted();
          else
            setError("Delete could not be confirmed. Your draft is retained.");
        }
      } else if (
        failure instanceof ApiError &&
        failure.code === "revision_conflict"
      )
        await reconcile({ title, content });
      else
        setError(
          failure instanceof ApiError
            ? failure.message
            : "Delete failed. Your draft is retained.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section ref={titleInput} className="mm-stack mm-note-editor" aria-label="Note editor">
      <div className="mm-editor-heading">
        <h2>{base ? "Edit note" : "New note"}</h2>
        <span className="mm-muted">Markdown</span>
      </div>
      <p className="mm-muted">
        Drafts stay in this tab until saved. Closing or reloading discards
        unsaved changes.
      </p>
      <TextField
        label="Title"
        placeholder="Untitled note"
        value={title}
        disabled={busy || !!pendingCreate}
        onChange={(event) => {
          setTitle(event.target.value);
          setState("unsaved");
        }}
      />
      <TextArea
        label="Markdown content"
        rows={16}
        placeholder="Start with a thought, a question, or something worth keeping…"
        value={content}
        disabled={busy || !!pendingCreate}
        onChange={(event) => {
          setContent(event.target.value);
          setState("unsaved");
        }}
      />
      <div className="mm-workspace-actions mm-editor-actions">
        <SaveStatus state={unavailable ? "error" : state} />
        <Button
          onClick={() => void save()}
          loading={busy}
          disabled={unavailable || !!latest || (!dirty && !!base)}
        >
          {pendingCreate ? "Retry same create" : "Save note"}
        </Button>
        {base && (
          <Button
            variant="danger"
            disabled={busy || unavailable}
            onClick={() => void remove()}
          >
            Delete note
          </Button>
        )}
      </div>
      {unavailable && (
        <Alert title="Note no longer available" tone="danger" urgent>
          This note was deleted or became inaccessible. Your unsaved draft
          remains editable for copying; choose New note to leave it.
        </Alert>
      )}
      {error && (
        <Alert title="Note needs attention" tone="danger" urgent>
          {error}
        </Alert>
      )}
      {latest && (
        <div className="mm-stack">
          <h3>Current server version (revision {latest.revision})</h3>
          <p>{latest.title}</p>
          <pre className="mm-server-version">{latest.content}</pre>
          <div className="mm-workspace-actions">
            <Button variant="secondary" onClick={() => accepted(latest)}>
              Use server version
            </Button>
            <Button
              onClick={() => {
                setBase(latest);
                setLatest(null);
                setError(
                  "Draft retained. Review and save explicitly against the latest revision.",
                );
                setState("unsaved");
              }}
            >
              Keep draft with latest revision
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
