'use client';
import { useEffect, useState } from 'react';
/** The only HTML sink: locally generated KaTeX, with trust disabled and bounded expansion. */
export function MathBlock({source,display}:{source:string;display:boolean}) {
 const limited = new TextEncoder().encode(source).length > 4096;
 const [result,setResult]=useState<{source:string;html:string}|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let current=true;
  if(limited) return;
  void import('katex').then(({default:katex})=>{
   const html=katex.renderToString(source,{displayMode:display,trust:false,throwOnError:false,maxExpand:100,maxSize:10,strict:'ignore',output:'htmlAndMathml'});
   if(current) setResult({source,html});
  }).catch(()=>{if(current)setFailed(true);});
  return ()=>{current=false;};
 },[source,display,limited]);
 if(limited) return <span><span role='status'>Math limit reached.</span><code>{source}</code></span>;
 if(result?.source===source) return <span className='mm-math' dangerouslySetInnerHTML={{__html:result.html}}/>;
 return <span>{failed && <span role='status'>Math could not be rendered.</span>}<code>{source}</code></span>;
}
