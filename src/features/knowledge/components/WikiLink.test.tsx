import {renderHook,act,render,screen,fireEvent} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import {useWikiNavigation} from "./WikiLink";
import type {KnowledgeApi} from "../api";
import type {NotesApi} from "../../notes/api";
// The user activation owns navigation; ambiguity never manufactures a UUID destination.
it("leaves duplicate targets unselected",async()=>{
 const select=vi.fn(),api={resolve:async()=>({items:[{target:"Target",key:"target",status:"ambiguous",note:null}]})} as unknown as KnowledgeApi;
 const {result}=renderHook(()=>useWikiNavigation({api,notesApi:{} as NotesApi,scope:{ownerId:"owner",generation:1,assertActive(){},async verify(){}},onSelect:select,onCreated:vi.fn()}));
 await act(()=>result.current.activate("Target"));expect(select).not.toHaveBeenCalled();
});

it("freezes create identity across an uncertain response and rechecks duplicate ambiguity",async()=>{
 const target="Missing",missing={target,key:"missing",status:"missing",note:null},ambiguous={...missing,status:"ambiguous"};
 let acknowledged=false;const resolve=vi.fn(async()=>({items:[acknowledged?ambiguous:missing]}));
 const create=vi.fn(async()=>{if(create.mock.calls.length===1)throw Error("Response lost");acknowledged=true;return {id:"33333333-3333-4333-8333-333333333333",title:target};});
 const select=vi.fn(),created=vi.fn();vi.spyOn(window,"confirm").mockReturnValue(true);
 function Harness(){const wiki=useWikiNavigation({api:{resolve} as unknown as KnowledgeApi,notesApi:{create} as unknown as NotesApi,scope:{ownerId:"owner",generation:1,assertActive(){},async verify(){}},onSelect:select,onCreated:created});return <><button onClick={()=>void wiki.activate(target)}>Follow</button>{wiki.panel}</>;}
 render(<Harness/>);await act(async()=>{fireEvent.click(screen.getByText("Follow"));});await screen.findByRole("button",{name:'Create “Missing”'});
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:'Create “Missing”'}));});await screen.findByText("Response lost");
 await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Retry create"}));});await screen.findByText(/Multiple notes match/);
 expect(create.mock.calls).toHaveLength(2);expect(create.mock.calls[1]).toEqual(create.mock.calls[0]);expect(created).toHaveBeenCalledOnce();expect(select).not.toHaveBeenCalled();
 vi.restoreAllMocks();
});
it("drops late resolution after editor unmount",async()=>{
 let finish!:(value:unknown)=>void;const resolve=()=>new Promise(resolve=>{finish=resolve;});const select=vi.fn();
 const hook=renderHook(()=>useWikiNavigation({api:{resolve} as unknown as KnowledgeApi,notesApi:{} as NotesApi,scope:{ownerId:"owner",generation:1,assertActive(){},async verify(){}},onSelect:select,onCreated:vi.fn()}));
 let pending!:Promise<void>;act(()=>{pending=hook.result.current.activate("Target");});hook.unmount();await act(async()=>{finish({items:[{target:"Target",key:"target",status:"resolved",note:{id:"target-id"}}]});await pending;});expect(select).not.toHaveBeenCalled();
});
import { StrictMode } from "react";
it("keeps activation usable after StrictMode effect replay",async()=>{
 const select=vi.fn();const api={resolve:async()=>({items:[{target:"Target",key:"target",status:"resolved",note:{id:"target-id"}}]})} as unknown as KnowledgeApi;
 const hook=renderHook(()=>useWikiNavigation({api,notesApi:{} as NotesApi,scope:{ownerId:"owner",generation:1,assertActive(){},async verify(){}},onSelect:select,onCreated:vi.fn()}),{wrapper:StrictMode});
 await act(()=>hook.result.current.activate("Target"));expect(select).toHaveBeenCalledWith("target-id");
});
