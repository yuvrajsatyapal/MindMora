import DOMPurify from 'dompurify';
/** Strict input admission supplements Mermaid's fixed config; source cannot load resources. */
export function allowedDiagram(source: string): boolean {
  return new TextEncoder().encode(source).length <= 10 * 1024 &&
    !/%%\s*\{|^\s*---|\b(?:click|href|callback|image|img|icon|classDef|style|linkStyle)\b|<\/?[a-z!]|(?:https?:|data:|javascript:|url\s*\()/im.test(source) &&
    (source.match(/-->|---|==>|-\.->|--[ox]|<--|<==|~~~|--|==|->|=>/g)?.length ?? 0) <= 200;
}
/** DOMPurify's SVG profile plus an explicit no-resource/no-active-navigation pass. */
export function sanitizeDiagramSvg(source: string): string {
  const purified = DOMPurify.sanitize(source, { USE_PROFILES: { svg: true, svgFilters: false }, FORBID_TAGS: ['script','foreignObject','style','image','animate','animateMotion','animateTransform','set'], FORBID_ATTR: ['style'] });
  const document = new DOMParser().parseFromString(purified, 'image/svg+xml');
  const svg = document.documentElement;
  if (svg.localName !== 'svg' || document.querySelector('parsererror')) throw new Error('Diagram unavailable');
  for (const element of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const marker = /^marker-(?:start|mid|end)$/.test(name) ? /^url\(#([a-zA-Z0-9_:.-]+)\)$/.exec(attribute.value) : null;
      const localMarker = marker && document.getElementById(marker[1])?.localName === 'marker';
      if (name.startsWith('on') || name === 'style' || name === 'href' || name === 'xlink:href' || (/url\s*\(/i.test(attribute.value) && !localMarker) || /(?:https?:|data:|javascript:|\/\/)/i.test(attribute.value) && name !== 'xmlns') element.removeAttribute(attribute.name);
    }
  }
  for (const element of Array.from(svg.querySelectorAll('text'))) { element.setAttribute('fill', '#222'); element.setAttribute('font-family', 'sans-serif'); }
  for (const element of Array.from(svg.querySelectorAll('rect,polygon,circle'))) { element.setAttribute('fill', '#eef0f3'); element.setAttribute('stroke', '#555'); }
  for (const element of Array.from(svg.querySelectorAll('path'))) { if (!element.hasAttribute('fill')) element.setAttribute('fill', 'none'); if (!element.hasAttribute('stroke')) element.setAttribute('stroke', '#555'); }
  return new XMLSerializer().serializeToString(svg);
}
export function diagramDocument(svg: string): string {
  const policy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"></head><body style="margin:0;background:white;color:#222">${svg}</body></html>`;
}

/** Mermaid 12.1 inserts a style via SVG.insertBefore and globally selects its SVG by ID.
 * Hook only this disposable subtree, before connecting it, to nonce generated styles synchronously.
 * No document/prototype patch; browser acceptance must cover this version-coupled adapter.
 */
export function createDiagramContainer(nonce:string):HTMLDivElement {
 const container=document.createElement('div');
 const html=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
 function prepare(node:Node):void {
  if(node instanceof Element && node.localName==='style' && nonce) node.setAttribute('nonce',nonce);
  // Preserve live measurement CSS, but omit it before Mermaid's internal
  // DOMPurify reparses serialized SVG (HTML serialization hides nonce values).
  // This is instance-scoped; the final output still passes our SVG sanitizer.
  if(node instanceof Element && html?.get && html.set) {
   const element=node;
   Object.defineProperty(element,'innerHTML',{configurable:true,
    get:()=>{
     if(!element.querySelector('style')) return html.get?.call(element);
     const copy=element.cloneNode(true) as Element;
     for(const style of copy.querySelectorAll('style')) style.remove();
     return html.get?.call(copy);
    },
    set:(value:string)=>html.set?.call(element,value),
   });
  }
  const append=node.appendChild;
  const insert=node.insertBefore;
  Object.defineProperty(node,'appendChild',{configurable:true,value:(child:Node)=>{prepare(child);return append.call(node,child);}});
  Object.defineProperty(node,'insertBefore',{configurable:true,value:(child:Node,before:Node|null)=>{prepare(child);return insert.call(node,child,before);}});
 }
 prepare(container);
 container.setAttribute('aria-hidden','true');
 container.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;width:1000px';
 document.body.appendChild(container);
 return container;
}
