import type {CompletionContext,CompletionResult} from "@codemirror/autocomplete";
import type {KnowledgeApi} from "./api";
import {eligibleProseRanges,validWikiTarget} from "./syntax";
export function wikiCompletion(api:KnowledgeApi){return async (context:CompletionContext):Promise<CompletionResult|null>=>{
 if(context.view?.composing)return null;
 const source=context.state.doc.toString(),before=source.slice(0,context.pos);
 const match=/\[\[([^\]\n|[]*)$/.exec(before);if(!match)return null;
 const start=context.pos-match[0].length;
 let escapes=0;for(let i=start-1;i>=0&&source[i]==="\\";i--)escapes++;
 if(escapes%2||source[start-1]==="!"||!eligibleProseRanges(source).some(range=>range.start<=start&&range.end>=context.pos))return null;
 const controller=new AbortController();context.addEventListener("abort",()=>controller.abort(),{onDocChange:true});
 try {
  const page=await api.complete(match[1],controller.signal);
  if(context.aborted||controller.signal.aborted||context.view?.composing)return null;
  return {from:start+2,to:context.pos+(source.slice(context.pos,context.pos+2)==="]]"?2:0),options:page.items.filter(note=>validWikiTarget(note.title)).map(note=>({label:note.title,detail:`Note · ${note.id.slice(0,8)}`,type:"text",apply:(view,_completion,from,to)=>{if(view.composing)return;view.dispatch({changes:{from,to,insert:note.title+"]]"},selection:{anchor:from+note.title.length+2},userEvent:"input.complete"});}}))};
 }catch{return null;}
};}
