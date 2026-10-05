'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { Element, Root } from 'hast';
import { jsx, jsxs } from 'react/jsx-runtime';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { parseMarkdown, safeMarkdownUrl } from '../markdown';
import type { PreviewResult } from '../markdown';
import { MathBlock } from './MathBlock';
import { MermaidBlock } from './MermaidBlock';
function text(node:Element):string { return node.children.map(child=>child.type==='text'?child.value:child.type==='element'?text(child):'').join(''); }
function classes(node?:Element):string[] { const value=node?.properties.className; return Array.isArray(value)?value.map(String):[]; }
function PreviewTree({tree,nonce}:{tree:Root;nonce?:string}) {
 const count=useRef(0);
 const claimRender=()=>{if(count.current>=3)return false;count.current++;return true;};
 return toJsxRuntime(tree,{Fragment,jsx,jsxs,passNode:true,components:{
  a:({href,children}:ComponentProps<'a'>)=>{
   const safe=typeof href==='string'?safeMarkdownUrl(href):undefined;
   return safe?<a href={safe} rel='noopener noreferrer' referrerPolicy='no-referrer' target={/^https:/i.test(safe)?'_blank':undefined}>{children}</a>:<span>{children}</span>;
  },
  img:({src,alt}:ComponentProps<'img'>)=>{
   const safe=typeof src==='string'?safeMarkdownUrl(src):undefined;
   return <span className='mm-image-placeholder'><span>{alt||'Image'}</span><code>{typeof src==='string'?src:'Blocked image source'}</code>{safe && /^https:/i.test(safe) && <a href={safe} target='_blank' rel='noopener noreferrer' referrerPolicy='no-referrer'>Open image source</a>}</span>;
  },
  input:({checked}:ComponentProps<'input'>)=><input type='checkbox' checked={Boolean(checked)} disabled readOnly aria-label='Markdown task'/>,
  pre:({node,children}:{node?:Element;children?:ReactNode})=>{
   const child=node?.children[0];
   if(child?.type==='element' && child.tagName==='code'){
    const names=classes(child); const source=text(child);
    if(names.includes('language-mermaid'))return <MermaidBlock source={source} claimRender={claimRender} nonce={nonce}/>;
    if(names.includes('math-display'))return <MathBlock source={source} display/>;
   }
   return <pre>{children}</pre>;
  },
  code:({node,children}:{node?:Element;children?:ReactNode})=>classes(node).includes('math-inline')?<MathBlock source={node?text(node):''} display={false}/>:<code>{children}</code>,
 }}) as ReactNode;
}
/** Disposable derived preview. A source change immediately hides the previous render generation. */
export function MarkdownPreview({content,nonce}:{content:string;nonce?:string}) {
 const [result,setResult]=useState<{source:string;preview:PreviewResult|null}|null>(null);
 useEffect(()=>{
  const timer=setTimeout(()=>{
   try{setResult({source:content,preview:parseMarkdown(content)});}catch{setResult({source:content,preview:null});}
  },250);
  return ()=>clearTimeout(timer);
 },[content]);
 const current=result?.source===content?result.preview:undefined;
 return <div className='mm-markdown-preview'>
  {current===undefined?<p role='status'>Updating preview…</p>:current===null?<p role='status'>Preview could not be rendered; source editing and saving remain available.</p>:current.limited?<p role='status'>Preview limit reached; source editing and saving remain available.</p>:<PreviewTree key={content} tree={current.tree} nonce={nonce}/>}
 </div>;
}
