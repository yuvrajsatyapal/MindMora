import { describe, expect, it } from 'vitest';
import { allowedDiagram, diagramDocument, sanitizeDiagramSvg, createDiagramContainer } from './svg';
describe('diagram isolation', () => {
 it('retains validated local marker arrows while removing external or missing marker references', () => {
 const safe=sanitizeDiagramSvg('<svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow"><path d="M0 0L1 1"/></marker></defs><path marker-end="url(#arrow)"/><path marker-start="url(https://evil.test/#arrow)"/><path marker-mid="url(#missing)"/></svg>');
 expect(safe).toContain('marker-end="url(#arrow)"');
 expect(safe).not.toContain('marker-start=');expect(safe).not.toContain('marker-mid=');
 });
 it('authorizes generated measurement styles before insertion without patching global DOM', () => {
 const container=createDiagramContainer('test-nonce');
 const div=document.createElement('div');container.appendChild(div);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');div.appendChild(svg);
 const style=document.createElement('style');style.textContent='svg{color:black}';svg.insertBefore(style,null);
 expect(style.nonce).toBe('test-nonce');
 expect(svg.querySelector('style')).toBe(style);
 // Mermaid serializes its enclosing div before its own sanitizer reparses it.
 expect(div.innerHTML).not.toContain('<style');
 expect(div.innerHTML).toContain('<svg');
 const unrelated=document.createElement('style');document.body.appendChild(unrelated);
 expect(unrelated.nonce).toBe('');
 unrelated.remove();container.remove();
 });
 it('retains geometry while removing SVG executable/resource capabilities', () => {
 const safe = sanitizeDiagramSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><foreignObject><img src="https://evil.test/x"/></foreignObject><style>.x{fill:url(https://evil.test/x)}</style><a href="https://evil.test"><text onclick="evil()">Label</text></a><rect width="10" fill="url(https://evil.test/x)"/><use href="https://evil.test/x"/><path d="M0 0" style="stroke:red"/></svg>');
 expect(safe).toContain('<rect'); expect(safe).toContain('Label');
 expect(safe).not.toMatch(/script|foreignObject|onclick|https:|url\(|<style|style=/i);
 });
 it('rejects config, click/resource inputs and complexity before invoking Mermaid', () => {
 expect(allowedDiagram('graph TD\n A-->B')).toBe(true);
 for (const source of ['%%{init: {}}%%\ngraph TD\nA-->B', '---\nconfig: {}\n---\ngraph TD', 'graph TD\nclick A "https://evil.test"', 'graph TD\nA[<img src=x>]', 'graph TD\n'+ 'A-->B\n'.repeat(201), 'x'.repeat(10241)]) expect(allowedDiagram(source)).toBe(false);
 });
 it('provides a scriptless isolated document policy', () => {
 expect(diagramDocument('<svg></svg>')).toContain("script-src 'none'");
 expect(diagramDocument('<svg></svg>')).toContain("connect-src 'none'");
 });
});
