import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const diagram = vi.hoisted(()=>({render:vi.fn(),initialize:vi.fn()}));
vi.mock('mermaid',()=>({default:diagram}));
import { MermaidBlock } from './MermaidBlock';
it('rejects diagram config before lazy import and retains source',()=>{
 const source='%%{init: {securityLevel: "loose"}}%%\ngraph TD';
 render(<MermaidBlock source={source} claimRender={()=>true}/>);
 fireEvent.click(screen.getByRole('button',{name:'Render diagram'}));
 expect(screen.getByRole('status')).toHaveTextContent('Diagram cannot be rendered safely.');
 expect(screen.getByRole('region', {name:'Mermaid diagram'}).querySelector('code')?.textContent).toBe(source);
});
it('enforces preview generation admission without loading a diagram',()=>{
 render(<MermaidBlock source='graph TD\nA-->B' claimRender={()=>false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Render diagram'}));
 expect(screen.getByRole('status')).toHaveTextContent('Diagram limit reached for this preview.');
});

it('removes in-progress measurement DOM immediately and discards a late result after unmount',async()=>{
 let resolve:(value:{svg:string})=>void=()=>{};
 diagram.render.mockImplementation(()=>new Promise<{svg:string}>(done=>{resolve=done;}));
 const view=render(<MermaidBlock source='graph TD\nA-->B' nonce='nonce' claimRender={()=>true}/>);
 fireEvent.click(screen.getByRole('button',{name:'Render diagram'}));
 await waitFor(()=>expect(diagram.render).toHaveBeenCalled());
 const container=diagram.render.mock.calls[0][2] as HTMLElement;
 expect(container.isConnected).toBe(true);
 view.unmount();
 expect(container.isConnected).toBe(false);
 await act(async()=>resolve({svg:'<svg xmlns="http://www.w3.org/2000/svg"><text>late</text></svg>'}));
 expect(document.querySelector('iframe')).toBeNull();
});
