import {EditorView} from "@codemirror/view";
import {history,undo} from "@codemirror/commands";
import {EditorState} from "@codemirror/state";
import {CompletionContext} from "@codemirror/autocomplete";
import {expect,it,vi} from "vitest";
import {wikiCompletion} from "./wiki-completion";
import type {KnowledgeApi} from "./api";
const complete=vi.fn(async()=>({items:[{id:"33333333-3333-4333-8333-333333333333",userId:"11111111-1111-4111-8111-111111111111",title:"Target",revision:1}],nextCursor:null}));
const api={complete} as unknown as KnowledgeApi;
it("completes an eligible open wiki target without closing twice",async()=>{
 const source="Read [[Tar]]";const state=EditorState.create({doc:source});const result=await wikiCompletion(api)(new CompletionContext(state,10,false));expect(result?.from).toBe(7);expect(result?.options[0].label).toBe("Target");expect(result?.to).toBe(12);
});
it("keeps excluded code and escaped/embed prefixes inert",async()=>{
 for(const source of ["`[[Tar`", "\\[[Tar", "![[Tar", "```md\n[[Tar"]){expect(await wikiCompletion(api)(new CompletionContext(EditorState.create({doc:source}),source.startsWith("`")&&!source.startsWith("```")?source.length-1:source.length,false))).toBeNull();}
});

it("inserts portable syntax as one undoable transaction",async()=>{
 const view=new EditorView({state:EditorState.create({doc:"[[Tar]]",extensions:[history()]})});
 const result=await wikiCompletion(api)(new CompletionContext(view.state,5,false)),option=result!.options[0];
 if(typeof option.apply!=="function")throw Error("Expected a transaction adapter");
 option.apply(view,option,result!.from,result!.to!);expect(view.state.doc.toString()).toBe("[[Target]]");expect(undo(view)).toBe(true);expect(view.state.doc.toString()).toBe("[[Tar]]");view.destroy();
});
it("does not request completion during IME composition",async()=>{
 complete.mockClear();const context=new CompletionContext(EditorState.create({doc:"[[Tar"}),5,false);Object.defineProperty(context,"view",{value:{composing:true}});
 expect(await wikiCompletion(api)(context)).toBeNull();expect(complete).not.toHaveBeenCalled();
});
it("drops a completed request when the completion context has become stale",async()=>{
 const context=new CompletionContext(EditorState.create({doc:"[[Tar"}),5,false),staleApi={complete:async()=>{Object.defineProperty(context,"aborted",{value:true});return {items:[],nextCursor:null};}} as unknown as KnowledgeApi;
 expect(await wikiCompletion(staleApi)(context)).toBeNull();
});
