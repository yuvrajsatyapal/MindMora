import { render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { MathBlock } from './MathBlock';
it('renders real KaTeX with MathML while refusing trusted HTML and URL commands',async()=>{
 const view=render(<MathBlock source={'\\href{javascript:evil}{x} + x^2'} display={false}/>);
 await waitFor(()=>expect(view.container.querySelector('math')).not.toBeNull());
 expect(view.container.querySelector('a,script,img')).toBeNull();
});
it('caps individual math expressions without invoking large expansion',()=>{
 render(<MathBlock source={'x'.repeat(4097)} display/>);
 expect(screen.getByText('Math limit reached.')).toBeInTheDocument();
});
