import type { Note } from '../notes/types';
export type EditorDraft = {
    title: string;
    content: string;
};
export type SavePhase = 'clean' | 'dirty' | 'saving' | 'invalid' | 'paused' | 'reconciling' | 'conflict' | 'unavailable';
export type SaveOperation = {
    kind: 'create';
    sequence: number;
    input: EditorDraft;
    key: string;
} | {
    kind: 'update';
    sequence: number;
    input: EditorDraft;
    id: string;
    expectedRevision: number;
};
export type SaveMachine = {
    base: Note | null;
    draft: EditorDraft;
    sequence: number;
};
export function initialMachine(note: Note | null): SaveMachine { return { base: note, draft: { title: note?.title ?? '', content: note?.content ?? '' }, sequence: 0 }; }
export function editMachine(state: SaveMachine, patch: Partial<EditorDraft>): SaveMachine { return { ...state, sequence: state.sequence + 1, draft: { ...state.draft, ...patch } }; }
export function acknowledge(state: SaveMachine, operation: SaveOperation, note: Note): SaveMachine { return { ...state, base: note, draft: state.sequence === operation.sequence ? { title: note.title, content: note.content } : state.draft }; }
export function sameDraft(a: EditorDraft, b: EditorDraft): boolean { return a.title === b.title && a.content === b.content; }
