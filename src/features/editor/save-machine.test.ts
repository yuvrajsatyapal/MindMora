import { describe, expect, it } from 'vitest';
import { initialMachine, editMachine, acknowledge, type SaveOperation } from './save-machine';
import type { Note } from '../notes/types';
const note: Note = { id: 'note', userId: 'owner', title: 'Title', content: 'old', revision: 1, createdAt: '', updatedAt: '', deletedAt: null };
describe('save snapshots', () => {
    it('increments the sequence for local edits', () => { expect(editMachine(initialMachine(note), { content: 'new' }).sequence).toBe(1); });
    it('retains newer edits when an earlier snapshot commits', () => {
        const edited = editMachine(initialMachine(note), { content: 'first' });
        const op: SaveOperation = { kind: 'update', sequence: edited.sequence, input: edited.draft, id: note.id, expectedRevision: 1 };
        const newer = editMachine(edited, { content: 'second' });
        const next = acknowledge(newer, op, { ...note, content: 'first', revision: 2 });
        expect(next.draft.content).toBe('second');
        expect(next.base?.revision).toBe(2);
    });
});
