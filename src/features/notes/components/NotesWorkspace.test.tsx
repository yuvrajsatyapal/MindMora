import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { NotesWorkspace } from "./NotesWorkspace";

const fixture = vi.hoisted(() => ({select: vi.fn(), note: {id:"33333333-3333-4333-8333-333333333333",userId:"11111111-1111-4111-8111-111111111111",title:"Title",content:"body",revision:2,createdAt:"2026-10-05T00:00:00.000Z",updatedAt:"2026-10-05T00:00:00.000Z",deletedAt:null}}));
vi.mock("../use-note-selection", () => ({useNoteSelection: () => ({id:null,invalid:false,select:fixture.select})}));
vi.mock("../hooks", () => ({noteKeys: () => ["notes"],useNotes: () => ({data:{pages:[{items:[]}]}}),useNote: () => ({data:null})}));
vi.mock("./NoteEditor", () => ({NoteEditor: ({onSaved,onDirty}:{onSaved:(note:typeof fixture.note)=>void;onDirty:(value:boolean)=>void}) => <button onClick={() => {onDirty(true);onSaved(fixture.note);}}>Acknowledge older snapshot</button>}));
it("does not clear a newer draft guard when an older snapshot is acknowledged", async () => {
 const dirtyRef = {current:false};
 render(<QueryClientProvider client={new QueryClient()}><NotesWorkspace scope={{ownerId:fixture.note.userId,generation:1,assertActive:vi.fn(),verify:async()=>{}}} dirtyRef={dirtyRef} /></QueryClientProvider>);
 fireEvent.click(screen.getByText("Acknowledge older snapshot"));
 await waitFor(() => expect(dirtyRef.current).toBe(true));
 expect(fixture.select).toHaveBeenCalledWith(fixture.note.id);
});
