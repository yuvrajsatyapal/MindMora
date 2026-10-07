import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { Root, Nodes } from 'mdast';
export type DerivedLink = { targetKey:string; targetTitle:string; occurrenceCount:number; context:string };
export type DerivedTag = { tagKey:string; displayName:string };
export type WikiOccurrence = { start:number; end:number; target:string; label?:string };
export function normalizeTitleKey(value:string):string { return value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase(); }
export function normalizeTagKey(value:string):string { return value.normalize('NFKC').toLowerCase(); }
export function validWikiTarget(value:string):boolean { return value.trim().length>0 && Array.from(value.trim()).length<=200 && !/[\p{Cc}\p{Cf}\r\n[\]|]/u.test(value); }
const processor=unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const proseProcessor=unified().use(remarkParse).use(remarkMath);
const htmlVoid=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const excluded=new Set(['code','inlineCode','html','link','linkReference','image','imageReference','math','inlineMath','definition']);
/** Positions are source UTF-16 offsets, preserving escaped syntax distinctions. */
export function eligibleProseRanges(source:string):{start:number;end:number}[] {
 // Neutralize portable delimiters for remark's link-candidate scanner, keeping
 // offsets and all inner Markdown intact. Existing Markdown destinations retain
 // an outer bracket pair, so the AST still excludes their complete link nodes.
 const parseSource=source.replace(/\[\[([^\]\r\n[]*)\]\]/g,(match:string,inside:string,offset:number)=>{
  const destination=source[offset+match.length];
  const plainInside=inside.replace(/[@:]/g,'a');
  return destination==='('||destination==='[' ? '[a'+plainInside+'a]' : 'aa'+plainInside+'aa';
 });
 const tree=proseProcessor.parse(parseSource) as Root;
 const prose:{start:number;end:number}[]=[];const blocked:{start:number;end:number}[]=[];
 const htmlStack:{name:string;start:number}[]=[];
 const pending:Nodes[]=[tree];
 while(pending.length){const node=pending.pop()!;const start=node.position?.start.offset,end=node.position?.end.offset;
  if(start!==undefined&&end!==undefined){
   if(excluded.has(node.type))blocked.push({start,end});
   if(['paragraph','heading','tableCell'].includes(node.type))prose.push({start,end});
   if(node.type==='html'){const match=/^<\s*(\/?)\s*([a-z][\w-]*)\b/i.exec(node.value);if(match){if(match[1]){const matching=htmlStack.findLastIndex(open=>open.name===match[2].toLowerCase());if(matching>=0){const open=htmlStack[matching];htmlStack.splice(matching);blocked.push({start:open.start,end});}}else if(!/\/>$/.test(node.value)&&!htmlVoid.has(match[2].toLowerCase()))htmlStack.push({name:match[2].toLowerCase(),start});}}
  }
  if(!excluded.has(node.type)&&'children' in node)for(let i=node.children.length-1;i>=0;i--)pending.push(node.children[i] as Nodes);
 }
 // GFM autolink scanning across a megabyte paragraph is quadratic. Its link
 // exclusion is equivalent on individual whitespace-delimited candidates;
 // all structural Markdown/code/math/HTML exclusions still come from the AST.
 for(const part of prose){const candidate=/\S+/g;const text=parseSource.slice(part.start,part.end);let token:RegExpExecArray|null;
  while((token=candidate.exec(text))){if(!/https?:\/\/|www\.|@/i.test(token[0]))continue;const links:Nodes[]=[processor.parse(token[0]) as Root];while(links.length){const node=links.pop()!;if(node.type==='link'&&node.position?.start.offset!==undefined&&node.position.end.offset!==undefined)blocked.push({start:part.start+token.index+node.position.start.offset,end:part.start+token.index+node.position.end.offset});else if('children' in node)for(const child of node.children)links.push(child as Nodes);}}
 }
 for(const open of htmlStack)blocked.push({start:open.start,end:source.length});
 blocked.sort((a,b)=>a.start-b.start);const merged:{start:number;end:number}[]=[];
 for(const block of blocked){const last=merged.at(-1);if(last&&block.start<=last.end)last.end=Math.max(last.end,block.end);else merged.push({...block});}
 const ranges:{start:number;end:number}[]=[];let index=0;
 for(const part of prose){let start=part.start;while(index<merged.length&&merged[index].end<=start)index++;let current=index;
  while(current<merged.length&&merged[current].start<part.end){const block=merged[current++];if(block.start>start)ranges.push({start,end:block.start});start=Math.max(start,block.end);}
  if(start<part.end)ranges.push({start,end:part.end});
 }
 return ranges;
}
function escaped(source:string,index:number){let count=0;while(index>0&&source[--index]==='\\')count++;return count%2===1;}
function occurrences(source:string,ranges:{start:number;end:number}[]):WikiOccurrence[]{
 const result:WikiOccurrence[]=[];
 for(const range of ranges){const prose=source.slice(range.start,range.end);const pattern=/\[\[([^[\]\r\n]*)\]\]/g;let m:RegExpExecArray|null;
 while((m=pattern.exec(prose))){const start=range.start+m.index; if(escaped(source,start)||source[start-1]==='!'||source[start-1]==='['||escaped(source,start+1)||escaped(source,start+m[0].length-2))continue;const pieces=m[1].split('|');if(pieces.length>2||!validWikiTarget(pieces[0])||(pieces[1]!==undefined&&(!pieces[1].trim()||/[\p{Cc}\p{Cf}]/u.test(pieces[1]))))continue;result.push({start,end:start+m[0].length,target:pieces[0].trim(),...(pieces[1]!==undefined?{label:pieces[1].trim()}: {})});}}
 return result;
}
export function wikiOccurrences(source:string):WikiOccurrence[]{return occurrences(source,eligibleProseRanges(source));}
export function extractKnowledge(source:string):{links:DerivedLink[];tags:DerivedTag[]} {
 const ranges=eligibleProseRanges(source); const wiki=occurrences(source,ranges);const links=new Map<string,DerivedLink>();const tags=new Map<string,DerivedTag>();
 for(const occurrence of wiki){const key=normalizeTitleKey(occurrence.target);const old=links.get(key);if(old)old.occurrenceCount++;else links.set(key,{targetKey:key,targetTitle:occurrence.target,occurrenceCount:1,context:Array.from(source.slice(Math.max(0,occurrence.start-60),occurrence.end+160).replace(/\s+/g,' ')).slice(0,240).join('')});}
 let wikiIndex=0;
 for(const range of ranges){const prose=source.slice(range.start,range.end);const regex=/#([\p{L}\p{N}_-]+)/gu;let match:RegExpExecArray|null;
 while((match=regex.exec(prose))){const index=range.start+match.index;const lastUnit=source.charCodeAt(index-1);const before=source.slice(index-(lastUnit>=0xdc00&&lastUnit<=0xdfff?2:1),index);const display=match[1];while(wikiIndex<wiki.length&&wiki[wikiIndex].end<=index)wikiIndex++;const inWiki=wikiIndex<wiki.length&&index>=wiki[wikiIndex].start; if(escaped(source,index)||(before&&/[\p{L}\p{N}_/#\\]/u.test(before))||!/[\p{L}\p{N}]/u.test(display)||/^[\p{N}]+$/u.test(display)||Array.from(display).length>64||inWiki)continue; const key=normalizeTagKey(display);if(!tags.has(key))tags.set(key,{tagKey:key,displayName:display});}}
 return {links:[...links.values()],tags:[...tags.values()]};
}
