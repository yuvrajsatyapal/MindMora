"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Note } from "../notes/types";
import type { NotesApi } from "../notes/api";
import { createNoteSchema } from "../notes/validation";
import { ApiError } from "../../lib/api/client";
import { acknowledge, editMachine, initialMachine, sameDraft, type EditorDraft, type SaveOperation, type SavePhase } from "./save-machine";
export type AutosaveOptions = {
    note: Note | null;
    api: NotesApi;
    unavailable?: boolean;
    onSaved: (note: Note) => void;
    onDeleted: () => void;
    onDirty: (dirty: boolean) => void;
};
const validationMessage = "Use a non-empty title of at most 200 characters and content of at most 1 MiB, without NUL characters.";
/** One memory-only draft lease. Refs capture immutable operations before any awaited API call. */
export function useNoteAutosave(options: AutosaveOptions) {
    const optionsRef = useRef(options);
    useLayoutEffect(() => { optionsRef.current = options; });
    const machine = useRef(initialMachine(options.note));
    const phaseRef = useRef<SavePhase>(options.note ? "clean" : "dirty");
    const messageRef = useRef("");
    const latestRef = useRef<Note | null>(null);
    const unresolved = useRef<SaveOperation | null>(null);
    const active = useRef<Promise<void> | null>(null);
    const queuedSave = useRef(false);
    const deleting = useRef(false);
    const pendingDelete = useRef<Note | null>(null);
    const mounted = useRef(true);
    const lease = useRef(0);
    const composing = useRef(false);
    const lastEdit = useRef(0);
    const lastAutomatic = useRef(-Infinity);
    const cooldown = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [view, publish] = useState(() => ({ draft: initialMachine(options.note).draft, base: options.note, phase: (options.note ? "clean" : "dirty") as SavePhase, message: "", latest: null as Note | null, busy: false, dirty: false, cooldownSeconds: 0, version: 0 }));
    const version = view.version;
    function refresh() {
        if (!mounted.current)
            return;
        publish(previous => ({ draft: machine.current.draft, base: machine.current.base, phase: phaseRef.current, message: messageRef.current, latest: latestRef.current, busy: !!active.current || deleting.current, dirty: isDirty(), cooldownSeconds: Math.max(0, Math.ceil((cooldown.current - performance.now()) / 1000)), version: previous.version + 1 }));
    }
    function cancelTimer() { if (timer.current !== null)
        clearTimeout(timer.current); timer.current = null; }
    function state(phase: SavePhase, message = "") { phaseRef.current = phase; messageRef.current = message; refresh(); }
    function isDirty() {
        const parsed = createNoteSchema.safeParse(machine.current.draft);
        const changed = machine.current.base ? !parsed.success || !sameDraft(parsed.data, machine.current.base) : machine.current.sequence > 0;
        return changed || !!unresolved.current || !!active.current || deleting.current || !!pendingDelete.current;
    }
    function alive(generation: number) { return mounted.current && generation === lease.current; }
    function accept(result: Note, operation: SaveOperation) {
        machine.current = acknowledge(machine.current, operation, result);
        unresolved.current = null;
        latestRef.current = null;
        optionsRef.current.onSaved(result);
        state(createNoteSchema.safeParse(machine.current.draft).success && sameDraft(createNoteSchema.parse(machine.current.draft), result) ? "clean" : "dirty");
    }
    function conflict(result: Note) { latestRef.current = result; state("conflict", "The server has a different version. Your draft is retained. Choose how to resolve it."); }
    function isUnavailable() { return phaseRef.current === "unavailable"; }
    function missing() { state("unavailable", "This note is unavailable. Your draft remains editable for copying."); }
    async function reconcile(operation: SaveOperation, generation: number) {
        if (operation.kind !== "update")
            return;
        state("reconciling", "Checking whether the server saved this snapshot.");
        try {
            const result = await optionsRef.current.api.read(operation.id);
            if (!alive(generation))
                return;
            if (sameDraft(result, operation.input) && result.revision > operation.expectedRevision)
                accept(result, operation);
            else
                conflict(result);
        }
        catch (error) {
            if (!alive(generation))
                return;
            if (error instanceof ApiError && (error.status === 404 || error.code === "not_found"))
                missing();
            else {
                if (error instanceof ApiError && error.status === 429) cooldown.current = performance.now() + (error.retryAfter ?? 60) * 1000;
                state("paused", "Unable to reconcile the save. Retry checks the server before another write.");
            }
        }
    }
    async function execute(automatic: boolean) {
        if (active.current) {
            if (!automatic && !deleting.current && !unresolved.current)
                queuedSave.current = true;
            return;
        }
        if (!mounted.current || deleting.current || optionsRef.current.unavailable || isUnavailable() || latestRef.current || composing.current)
            return;
        if (performance.now() < cooldown.current) {
            state("paused", "Too many requests. Wait before retrying.");
            return;
        }
        if (automatic && phaseRef.current !== "dirty" && phaseRef.current !== "invalid")
            return;
        cancelTimer();
        const captured = machine.current;
        const parsed = createNoteSchema.safeParse(captured.draft);
        if (!unresolved.current && !pendingDelete.current && !parsed.success) {
            state("invalid", validationMessage);
            return;
        }
        if (!unresolved.current && !pendingDelete.current && captured.base && parsed.success && sameDraft(parsed.data, captured.base)) {
            state("clean");
            return;
        }
        const operation: SaveOperation = unresolved.current ?? (captured.base
            ? { kind: "update", sequence: captured.sequence, input: parsed.success ? parsed.data : captured.draft, id: captured.base.id, expectedRevision: captured.base.revision }
            : { kind: "create", sequence: captured.sequence, input: parsed.success ? parsed.data : captured.draft, key: crypto.randomUUID() });
        const generation = lease.current;
        if (automatic)
            lastAutomatic.current = performance.now();
        const task = async () => {
            if (pendingDelete.current) { await reconcileDeletion(pendingDelete.current, generation); return; }
            // An unresolved PATCH can only be retried by reading its persisted outcome.
            if (unresolved.current?.kind === "update") {
                await reconcile(operation, generation);
                return;
            }
            state("saving");
            try {
                const result = operation.kind === "create" ? await optionsRef.current.api.create(operation.input, operation.key) : await optionsRef.current.api.update(operation.id, { ...operation.input, expectedRevision: operation.expectedRevision });
                if (!alive(generation))
                    return;
                if (!sameDraft(result, operation.input)) {
                    // Replay may return a later server revision. Bind identity, but preserve draft for explicit review.
                    machine.current = { ...machine.current, base: result };
                    unresolved.current = null;
                    optionsRef.current.onSaved(result);
                    conflict(result);
                }
                else
                    accept(result, operation);
            }
            catch (error) {
                if (!alive(generation))
                    return;
                if (error instanceof ApiError && (error.status === 404 || error.code === "not_found")) {
                    missing();
                    return;
                }
                if (error instanceof ApiError && error.status === 429) {
                    cooldown.current = performance.now() + (error.retryAfter ?? 60) * 1000;
                    state("paused", error.message);
                    return;
                }
                const uncertain = !(error instanceof ApiError) || error.code === "uncertain" || error.code === "invalid_response" || error.status >= 500;
                if (operation.kind === "update" && (uncertain || (error instanceof ApiError && error.code === "revision_conflict"))) {
                    unresolved.current = operation;
                    await reconcile(operation, generation);
                }
                else {
                    if (operation.kind === "create" && uncertain)
                        unresolved.current = operation;
                    state("paused", error instanceof ApiError ? error.message : "Save failed. Your draft is retained.");
                }
            }
        };
        // Publish active before invoking async code so repeated calls cannot start another operation.
        active.current = Promise.resolve().then(task);
        refresh();
        try {
            await active.current;
        }
        finally {
            if (alive(generation)) {
                active.current = null;
                const flush = queuedSave.current;
                queuedSave.current = false;
                refresh();
                if (flush && phaseRef.current === "dirty" && !deleting.current)
                    await execute(false);
            }
        }
    }
    function edit(patch: Partial<EditorDraft>) {
        machine.current = editMachine(machine.current, patch);
        lastEdit.current = performance.now();
        if (["clean", "dirty", "invalid"].includes(phaseRef.current))
            phaseRef.current = isDirty() ? "dirty" : "clean";
        refresh();
    }
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; lease.current += 1; cancelTimer(); };
    }, []);
    useEffect(() => { optionsRef.current.onDirty(isDirty()); });
    useEffect(() => {
        if (options.unavailable) {
            cancelTimer();
            missing();
        }
        // Coordinator functions read current operation refs; published state does not change their behavior.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.unavailable]);
    useEffect(() => {
        const note = options.note;
        const base = machine.current.base;
        if (!note || !base || note.id !== base.id || note.revision <= base.revision || (latestRef.current && note.revision <= latestRef.current.revision) || active.current || options.unavailable)
            return;
        if (isDirty() || latestRef.current || unresolved.current)
            conflict(note);
        else {
            machine.current = initialMachine(note);
            state("clean");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.note, options.unavailable, version]);
    useEffect(() => {
        cancelTimer();
        if (!mounted.current || active.current || deleting.current || composing.current || options.unavailable || !["dirty", "invalid"].includes(phaseRef.current) || !isDirty())
            return;
        const delay = Math.max(0, lastEdit.current + 1500 - performance.now(), lastAutomatic.current + 5000 - performance.now());
        // Invalid drafts wait for a new edit instead of spinning a zero-delay timer.
        if (phaseRef.current === "invalid")
            return;
        timer.current = setTimeout(() => { timer.current = null; void execute(true); }, delay);
        return cancelTimer;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [version, options.unavailable]);
    const cooldownSeconds = view.cooldownSeconds;
    // The tick publishes a current coordinator snapshot without resetting admission.
    useEffect(() => {
        if (!cooldownSeconds) return;
        const id = setTimeout(refresh, 1000);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cooldownSeconds, version]);
    function keepDraft() {
        if (!latestRef.current || active.current)
            return;
        machine.current = { ...machine.current, base: latestRef.current };
        latestRef.current = null;
        unresolved.current = null;
        pendingDelete.current = null;
        state("paused", "Draft retained. Review and Save now explicitly against the latest revision.");
    }
    function useServerVersion() {
        if (!latestRef.current || active.current || (isDirty() && !window.confirm("Discard your draft and use the server version?")))
            return;
        const result = latestRef.current;
        machine.current = initialMachine(result);
        pendingDelete.current = null;
        latestRef.current = null;
        unresolved.current = null;
        optionsRef.current.onSaved(result);
        state("clean");
    }
    async function reconcileDeletion(base: Note, generation: number) {
        state("reconciling", "Checking whether the note was deleted.");
        try {
            const current = await optionsRef.current.api.read(base.id);
            if (alive(generation)) conflict(current);
        } catch (readError) {
            if (!alive(generation)) return;
            if (readError instanceof ApiError && (readError.status === 404 || readError.code === "not_found")) {
                pendingDelete.current = null;
                optionsRef.current.onDeleted();
            } else {
                if (readError instanceof ApiError && readError.status === 429) cooldown.current = performance.now() + (readError.retryAfter ?? 60) * 1000;
                state("paused", "Delete could not be confirmed. Retry checks the server before another mutation.");
            }
        }
    }
    async function remove() {
        if (deleting.current || optionsRef.current.unavailable || isUnavailable())
            return;
        if (performance.now() < cooldown.current) return;
        deleting.current = true;
        cancelTimer();
        refresh();
        const generation = lease.current;
        try {
            await active.current;
            if (!alive(generation))
                return;
            if (pendingDelete.current) { await reconcileDeletion(pendingDelete.current, generation); return; }
            const base = machine.current.base;
            if (!base || unresolved.current || latestRef.current || performance.now() < cooldown.current || isUnavailable())
                return;
            if (!window.confirm("Delete this note? Unsaved changes will be discarded."))
                return;
            state("saving");
            try {
                await optionsRef.current.api.remove(base.id, base.revision);
                if (alive(generation))
                    optionsRef.current.onDeleted();
            }
            catch (error) {
                if (!alive(generation))
                    return;
                if (error instanceof ApiError && error.status === 429) {
                    cooldown.current = performance.now() + (error.retryAfter ?? 60) * 1000;
                    state("paused", error.message);
                    return;
                }
                if (!(error instanceof ApiError) || error.code === "uncertain" || error.status >= 500 || error.code === "revision_conflict") {
                    pendingDelete.current = base;
                    await reconcileDeletion(base, generation);
                }
                else
                    state("paused", error.message);
            }
        }
        finally {
            if (alive(generation)) {
                deleting.current = false;
                refresh();
            }
        }
    }
    return { ...view, setTitle: (title: string) => edit({ title }), setContent: (content: string) => edit({ content }), setComposing: (value: boolean) => { composing.current = value; if (!value)
            lastEdit.current = performance.now(); refresh(); }, saveNow: () => execute(false), retry: () => execute(false), useServerVersion, keepDraft, remove };
}
