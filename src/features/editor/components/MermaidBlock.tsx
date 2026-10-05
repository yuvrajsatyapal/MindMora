'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { allowedDiagram, diagramDocument, sanitizeDiagramSvg, createDiagramContainer } from '../svg';
let diagramQueue: Promise<void> = Promise.resolve();
/** An explicit render uses a private disposable measurement container, never Mermaid's global body fallback. */
export function MermaidBlock({source,claimRender,nonce}:{source:string;claimRender:()=>boolean;nonce?:string}) {
 const id=useId().replace(/[^a-zA-Z0-9]/g,'');
 const generation=useRef(0);
 const measurement=useRef<HTMLDivElement|null>(null);
 const [document,setDocument]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>()=>{generation.current++;measurement.current?.replaceChildren();measurement.current?.remove();measurement.current=null;},[source]);
 function renderDiagram(){
  if(busy) return;
  if(!allowedDiagram(source)){setMessage('Diagram cannot be rendered safely.');return;}
  if(!claimRender()){setMessage('Diagram limit reached for this preview.');return;}
  const token=++generation.current;
  setBusy(true);setMessage('Rendering diagram…');
  const work=async()=>{
   if(token!==generation.current)return;
   const container=createDiagramContainer(nonce??'');
   measurement.current=container;
   try{
    const {default:mermaid}=await import('mermaid');
    if(token!==generation.current)return;
    mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,suppressErrorRendering:true,maxTextSize:10240,maxEdges:200,fontFamily:'sans-serif',flowchart:{htmlLabels:false},secure:['securityLevel','startOnLoad','maxTextSize','maxEdges','htmlLabels','secure']});
    const rendered=await mermaid.render(`mmDiagram${id}${token}`,source,container);
    const safe=diagramDocument(sanitizeDiagramSvg(rendered.svg));
    if(token===generation.current){setDocument(safe);setMessage('');}
   }catch{if(token===generation.current)setMessage('Diagram could not be rendered.');}
   finally{container.replaceChildren();container.remove(); if(measurement.current===container)measurement.current=null; if(token===generation.current)setBusy(false);}
  };
  // Mermaid has singleton configuration/render state; serialize jobs and check cancelled generations before work.
  diagramQueue=diagramQueue.then(work,work);
 }
 return <section className='mm-mermaid-block' aria-label='Mermaid diagram'>
  <pre className='mm-rich-source'><code>{source}</code></pre>
  <button type='button' onClick={renderDiagram} disabled={busy}>Render diagram</button>
  {message && <p role='status'>{message}</p>}
  {document && <iframe className='mm-diagram-frame' title='Rendered Mermaid diagram' sandbox='' referrerPolicy='no-referrer' srcDoc={document}/>}
 </section>;
}
