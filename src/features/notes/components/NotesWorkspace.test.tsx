import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { NotesWorkspace } from "./NotesWorkspace";

const fixture = vi.hoisted(() => ({select: vi.fn(), note: {id:"33333333-3333-4333-8333-333333333333",userId:"11111111-1111-4111-8111-111111111111",title:"Title",content:"body",revision:2,createdAt:"2026-10-05T00:00:00.000Z",updatedAt:"2026-10-05T00:00:00.000Z",deletedAt:null}}));
vi.mock("../use-note-selection", () => ({useNoteSelection: () => ({id:null,invalid:false,select:fixture.select})}));
vi.mock("../hooks", () => ({noteKeys: () => ["notes"],useNotes: () => ({data:{pages:[{items:[]}]}}),useNote: () => ({data:null})}));
vi.mock("./NoteEditor", () => ({NoteEditor: ({onSaved,onDirty}:{onSaved:(note:typeof fixture.note)=>void;onDirty:(value:boolean)=>void}) => <button onClick={() => {onDirty(true);onSaved(fixture.note);}}>Acknowledge older snapshot</button>}));
it("does not clear a newer draft guard when an older snapshot is acknowledged", async () => {
 const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
 const dirtyRef = {current:false};
 render(<QueryClientProvider client={new QueryClient()}><NotesWorkspace scope={{ownerId:fixture.note.userId,generation:1,assertActive:vi.fn(),verify:async()=>{}}} dirtyRef={dirtyRef} /></QueryClientProvider>);
 fireEvent.click(screen.getByText("Acknowledge older snapshot"));
 await waitFor(() => expect(dirtyRef.current).toBe(true));
 expect(fixture.select).toHaveBeenCalledWith(fixture.note.id);confirm.mockRestore();
});

vi.mock("../../knowledge/components/KnowledgeSearch",()=>({KnowledgeSearch:({onSelect}:{onSelect:(id:string)=>void})=><button onClick={()=>onSelect(fixture.note.id)}>Select server result</button>}));
vi.mock("../../knowledge/components/KnowledgeNoteEditor",()=>({KnowledgeNoteEditor:({onDirty,onSelect,onCreated}:{onDirty:(dirty:boolean)=>void;onSelect:(id:string)=>void;onCreated:(note:typeof fixture.note)=>void})=><><button onClick={()=>{onDirty(true);onSelect(fixture.note.id);}}>Follow wiki target</button><button onClick={()=>{onDirty(true);onCreated(fixture.note);}}>Acknowledge created target</button></>}));
it("knowledge navigation cannot bypass the existing newer-draft discard guard",()=>{
 fixture.select.mockClear();const confirm=vi.spyOn(window,"confirm").mockReturnValue(false),dirtyRef={current:false};
 render(<QueryClientProvider client={new QueryClient()}><NotesWorkspace knowledgeEnabled scope={{ownerId:fixture.note.userId,generation:1,assertActive:vi.fn(),verify:async()=>{}}} dirtyRef={dirtyRef}/></QueryClientProvider>);
 fireEvent.click(screen.getByText("Follow wiki target"));expect(confirm).toHaveBeenCalledWith("Discard unsaved changes in this tab?");expect(fixture.select).not.toHaveBeenCalled();expect(dirtyRef.current).toBe(true);confirm.mockRestore();
});
it("acknowledging a newly created wiki target retains the source draft and selection",()=>{
 fixture.select.mockClear();const dirtyRef={current:false};
 render(<QueryClientProvider client={new QueryClient()}><NotesWorkspace knowledgeEnabled scope={{ownerId:fixture.note.userId,generation:1,assertActive:vi.fn(),verify:async()=>{}}} dirtyRef={dirtyRef}/></QueryClientProvider>);
 fireEvent.click(screen.getByText("Acknowledge created target"));expect(fixture.select).not.toHaveBeenCalled();expect(dirtyRef.current).toBe(true);
});
