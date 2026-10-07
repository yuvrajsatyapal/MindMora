import type { Root, Element, RootContent } from "hast";
import {wikiOccurrences} from "../knowledge/syntax";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
export const PREVIEW_BYTES = 256 * 1024;
export type PreviewResult = { tree: Root; limited: false } | { limited: true };
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkRehype).use(rehypeSanitize, {
  tagNames: ['h1','h2','h3','h4','h5','h6','p','strong','em','del','ul','ol','li','blockquote','hr','br','table','thead','tbody','tr','th','td','pre','code','a','img','input'],
  attributes: { a: ['href','title'], img: ['src','alt','title'], ol: ['start'], input: [['type','checkbox'],'checked','disabled'], code: [['className', /^language-[\w-]+$/, 'math-inline', 'math-display']], th: [['align','left','right','center']], td: [['align','left','right','center']] },
  protocols: { href: ['https'], src: ['https'] },
  clobberPrefix: 'mm-preview-',
});
function withinNodeBudget(tree: unknown): boolean {
  let count = 0;
  const pending: unknown[] = [tree];
  while (pending.length) {
    const node = pending.pop();
    if (++count > 20000) return false;
    if (node && typeof node === 'object' && 'children' in node && Array.isArray(node.children)) pending.push(...node.children);
  }
  return true;
}
/** Sanitization belongs to preview; the original persisted Markdown is never rewritten. */
export function parseMarkdown(source: string, wikiEnabled=false): PreviewResult {
  if (new TextEncoder().encode(source).length > PREVIEW_BYTES) return { limited: true };
  // Preview-only admission bounds dense markup before the parser allocates its AST.
  // These reduce expensive inputs; they are not a preemptive CPU deadline.
  if ((source.match(/[*_~`[\]{}<>|$]/g)?.length ?? 0) > 2000 ||
      (source.match(/\n/g)?.length ?? 0) >= 5000) return { limited: true };
  const occurrences=wikiEnabled?wikiOccurrences(source):[];
  // Mask only shared-parser-admitted wiki ranges. A collision-free plain marker prevents
  // Markdown emphasis within an alias from turning the explicitly plain label into HTML.
  let prefix="MMWIKIPREVIEW";
  while(source.includes(prefix))prefix+="X";
  let offset=0,previewSource="";
  for(const [index,token] of occurrences.entries()){
    previewSource+=source.slice(offset,token.start)+prefix+index+"END";offset=token.end;
  }
  previewSource+=source.slice(offset);
  const parsed=processor.parse(previewSource);
  if(!withinNodeBudget(parsed))return {limited:true};
  const tree=processor.runSync(parsed) as Root;
  const marker=new RegExp(prefix+"([0-9]+)END","g");
  function replaceMarkers(node:Root|Element){
    const children:RootContent[]=[];
    for(const child of node.children){
      if(child.type!=="text"){if(child.type==="element")replaceMarkers(child);children.push(child);continue;}
      let start=0;
      for(const match of child.value.matchAll(marker)){
        const token=occurrences[Number(match[1])];
        if(!token)continue;
        if(match.index>start)children.push({type:"text",value:child.value.slice(start,match.index)});
        children.push({type:"element",tagName:"span",properties:{dataWikiTarget:token.target},children:[{type:"text",value:token.label??token.target}]});
        start=match.index+match[0].length;
      }
      if(start<child.value.length)children.push({type:"text",value:child.value.slice(start)});
    }
    node.children=children;
  }
  replaceMarkers(tree);
  return withinNodeBudget(tree) ? { tree, limited: false } : { limited: true };
}
/** No decoding/normalization rescue for obfuscated schemes, control characters or credentials. */
export function safeMarkdownUrl(value: string): string | undefined {
  if (!value || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || /[\s\\]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value) || /&(?:#|[a-z])/i.test(value) || value.startsWith('//')) return undefined;
  if (/^https:\/\//i.test(value)) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? value : undefined; } catch { return undefined; }
  }
  if (value.includes(':') || /^[^/?#]*%/i.test(value)) return undefined;
  return value;
}
