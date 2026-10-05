import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNoteAutosave } from './use-note-autosave';
import type { NotesApi } from '../notes/api';
import type { Note } from '../notes/types';
import { ApiError } from '../../lib/api/client';
const note: Note = { id: 'n', userId: 'o', title: 'Title', content: 'old', revision: 1, createdAt: '', updatedAt: '', deletedAt: null };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function setup(initial: Note | null = note) {
    const api: NotesApi = { list: vi.fn(), read: vi.fn(), create: vi.fn(), update: vi.fn(async (_id, input) => ({ ...note, title: input.title ?? note.title, content: input.content ?? note.content, revision: input.expectedRevision + 1 })), remove: vi.fn() };
    const onSaved = vi.fn();
    const onDirty = vi.fn();
    const onDeleted = vi.fn();
    const hook = renderHook(() => useNoteAutosave({ note: initial, api, onSaved, onDirty, onDeleted }));
    return { ...hook, api, onSaved, onDirty, onDeleted };
}
async function tick(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe('autosave scheduler', () => {
    it('debounces edits, keeps newer typing and spaces follow-up automatic saves', async () => {
        const s = setup();
        const pending = deferred<Note>();
        vi.mocked(s.api.update).mockReturnValueOnce(pending.promise);
        act(() => s.result.current.setContent('first'));
        await tick(1499);
        expect(s.api.update).not.toHaveBeenCalled();
        await tick(1);
        expect(s.result.current.phase).toBe('saving');
        act(() => s.result.current.setContent('second'));
        await act(async () => pending.resolve({ ...note, content: 'first', revision: 2 }));
        expect(s.result.current.draft.content).toBe('second');
        expect(s.result.current.dirty).toBe(true);
        await tick(4999);
        expect(s.api.update).toHaveBeenCalledTimes(1);
        await tick(1);
        expect(s.result.current.phase).toBe('clean');
        expect(s.result.current.dirty).toBe(false);
    });
    it('validates titles before requests and never autosaves the initial record', async () => { const s = setup(); await tick(10000); expect(s.api.update).not.toHaveBeenCalled(); act(() => s.result.current.setTitle(' ')); await tick(1500); expect(s.result.current.phase).toBe('invalid'); expect(s.api.update).not.toHaveBeenCalled(); });
});
describe('deliberate recovery', () => {
    it('freezes uncertain create payload and key while allowing later typing', async () => {
        const s = setup(null);
        vi.mocked(s.api.create).mockRejectedValueOnce(new ApiError('uncertain')).mockImplementationOnce(async (input) => ({ ...note, ...input }));
        act(() => s.result.current.setTitle('first'));
        await tick(1500);
        expect(s.result.current.phase).toBe('paused');
        const first = vi.mocked(s.api.create).mock.calls[0];
        act(() => s.result.current.setTitle('second'));
        await tick(10000);
        expect(s.api.create).toHaveBeenCalledTimes(1);
        await act(async () => s.result.current.retry());
        expect(vi.mocked(s.api.create).mock.calls[1]).toEqual(first);
        expect(s.result.current.draft.title).toBe('second');
        expect(s.result.current.dirty).toBe(true);
    });
    it('reads uncertain update before retrying and keeps conflict resolution paused', async () => {
        const s = setup();
        vi.mocked(s.api.update).mockRejectedValueOnce(new ApiError('uncertain'));
        vi.mocked(s.api.read).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ...note, content: 'remote', revision: 2 });
        act(() => s.result.current.setContent('mine'));
        await tick(1500);
        expect(s.result.current.phase).toBe('paused');
        await act(async () => s.result.current.retry());
        expect(s.result.current.phase).toBe('conflict');
        expect(s.api.update).toHaveBeenCalledTimes(1);
        act(() => s.result.current.keepDraft());
        await tick(10000);
        expect(s.api.update).toHaveBeenCalledTimes(1);
        await act(async () => s.result.current.saveNow());
        expect(vi.mocked(s.api.update).mock.calls[1][1].expectedRevision).toBe(2);
    });
    it('honors rate-limit cooldown and does not retry on elapsed time alone', async () => {
        const s = setup();
        vi.mocked(s.api.update).mockRejectedValueOnce(new ApiError('rate_limited', 429, undefined, 10));
        act(() => s.result.current.setContent('mine'));
        await tick(1500);
        await act(async () => s.result.current.saveNow());
        expect(s.api.update).toHaveBeenCalledTimes(1);
        await tick(10000);
        expect(s.api.update).toHaveBeenCalledTimes(1);
        await act(async () => s.result.current.retry());
        expect(s.result.current.phase).toBe('clean');
    });
    it('ignores a late acknowledgement after unmount', async () => {
        const s = setup();
        const d = deferred<Note>();
        vi.mocked(s.api.update).mockReturnValueOnce(d.promise);
        act(() => s.result.current.setContent('mine'));
        await tick(1500);
        s.unmount();
        await act(async () => d.resolve({ ...note, content: 'mine', revision: 2 }));
        expect(s.onSaved).not.toHaveBeenCalled();
    });
    it('serializes deletion behind a pending save and uses its acknowledged revision', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const s = setup();
        const d = deferred<Note>();
        vi.mocked(s.api.update).mockReturnValueOnce(d.promise);
        act(() => s.result.current.setContent('mine'));
        await tick(1500);
        let deletion: Promise<void>;
        act(() => { deletion = s.result.current.remove(); });
        expect(s.api.remove).not.toHaveBeenCalled();
        await act(async () => { d.resolve({ ...note, content: 'mine', revision: 2 }); await deletion!; });
        expect(s.api.remove).toHaveBeenCalledWith(note.id, 2);
        expect(s.onDeleted).toHaveBeenCalledOnce();
        vi.restoreAllMocks();
    });
});
describe('editor lease and explicit flush', () => {
    it('coalesces explicit saves made during a write and flushes latest draft once it finishes', async () => {
        const s = setup();
        const d = deferred<Note>();
        vi.mocked(s.api.update).mockReturnValueOnce(d.promise);
        act(() => s.result.current.setContent('first'));
        await tick(1500);
        act(() => s.result.current.setContent('second'));
        await act(async () => { void s.result.current.saveNow(); void s.result.current.saveNow(); });
        await act(async () => d.resolve({ ...note, content: 'first', revision: 2 }));
        expect(s.api.update).toHaveBeenCalledTimes(2);
        expect(s.result.current.phase).toBe('clean');
    });
    it('blocks automatic and explicit saves while IME composition is active', async () => {
        const s = setup();
        act(() => { s.result.current.setComposing(true); s.result.current.setContent('composing'); });
        await tick(5000);
        await act(async () => s.result.current.saveNow());
        expect(s.api.update).not.toHaveBeenCalled();
        act(() => s.result.current.setComposing(false));
        await tick(1500);
        expect(s.result.current.phase).toBe('clean');
    });
    it('reconsiders a newer refetch that arrived during an active write', async () => {
        const api: NotesApi = { list: vi.fn(), read: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
        const d = deferred<Note>();
        vi.mocked(api.update).mockReturnValue(d.promise);
        const s = renderHook(({ current }) => useNoteAutosave({ note: current, api, onSaved: vi.fn(), onDeleted: vi.fn(), onDirty: vi.fn() }), { initialProps: { current: note } });
        act(() => s.result.current.setContent('mine'));
        await tick(1500);
        s.rerender({ current: { ...note, content: 'remote', revision: 3 } });
        await act(async () => d.resolve({ ...note, content: 'mine', revision: 2 }));
        expect(s.result.current.draft.content).toBe('remote');
        expect(s.result.current.base?.revision).toBe(3);
    });
});
describe('unavailable and normalized drafts', () => {
    it('retains source and disables writes when reconciliation discovers deletion', async () => {
        const s = setup();
        vi.mocked(s.api.update).mockRejectedValueOnce(new ApiError('uncertain'));
        vi.mocked(s.api.read).mockRejectedValue(new ApiError('not_found'));
        act(() => s.result.current.setContent('mine'));
        await tick(1500);
        expect(s.result.current.phase).toBe('unavailable');
        act(() => s.result.current.setContent('copy me'));
        await tick(10000);
        await act(async () => s.result.current.saveNow());
        expect(s.api.update).toHaveBeenCalledTimes(1);
        expect(s.result.current.draft.content).toBe('copy me');
    });
    it('treats an unchanged normalized title as acknowledged without issuing a request', async () => {
        const s = setup();
        act(() => s.result.current.setTitle('  Title  '));
        await tick(1500);
        expect(s.api.update).not.toHaveBeenCalled();
        expect(s.result.current.phase).toBe('clean');
        expect(s.result.current.dirty).toBe(false);
    });
});
describe('new-note acknowledgement',()=>{
 it('never presents an untouched new note as saved and makes no request',async()=>{const s=setup(null);expect(s.result.current.phase).toBe('dirty');expect(s.result.current.dirty).toBe(false);await tick(10000);expect(s.api.create).not.toHaveBeenCalled();});
});
describe('uncertain deletion',()=>{
 it('keeps the navigation guard dirty and retries a read before any further mutation',async()=>{
  vi.spyOn(window,'confirm').mockReturnValue(true);const s=setup();vi.mocked(s.api.remove).mockRejectedValue(new ApiError('uncertain'));vi.mocked(s.api.read).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(note);
  await act(async()=>s.result.current.remove());expect(s.result.current.dirty).toBe(true);await act(async()=>s.result.current.retry());expect(s.api.remove).toHaveBeenCalledTimes(1);expect(s.api.update).not.toHaveBeenCalled();expect(s.result.current.phase).toBe('conflict');vi.restoreAllMocks();
 });
});
describe('reconciliation admission',()=>{
 it('respects Retry-After when the uncertainty check is rate limited',async()=>{
  const s=setup();vi.mocked(s.api.update).mockRejectedValueOnce(new ApiError('uncertain'));vi.mocked(s.api.read).mockRejectedValueOnce(new ApiError('rate_limited',429,undefined,10)).mockResolvedValueOnce({...note,content:'mine',revision:2});act(()=>s.result.current.setContent('mine'));await tick(1500);await act(async()=>s.result.current.retry());expect(s.api.read).toHaveBeenCalledTimes(1);await tick(10000);await act(async()=>s.result.current.retry());expect(s.result.current.phase).toBe('clean');
 });
});
