import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownPreview } from './MarkdownPreview';
afterEach(()=>vi.useRealTimers());
describe('controlled rich preview',()=>{
 it('keeps the owning preview pane as the only named preview landmark',()=>{
 render(<section aria-label='Markdown preview'><MarkdownPreview content='# Draft'/></section>);
 expect(screen.getAllByRole('region',{name:'Markdown preview'})).toHaveLength(1);
 });
 it('routes sanitized inline/display math into local trusted KaTeX output',async()=>{
 const view=render(<MarkdownPreview content={'Inline $x^2$\n\n$$\ny^2\n$$'}/>);
 await waitFor(()=>expect(view.container.querySelectorAll('math')).toHaveLength(2));
 expect(view.container.querySelector('.katex-display')).not.toBeNull();
 });
 it('keeps dangerous URL/image schemes inert and code fences escaped',async()=>{
 vi.useFakeTimers(); const view=render(<MarkdownPreview content={'[bad](javascript:evil)\n\n![bad image](data:image/svg+xml,evil)\n\n```html\n<img src=x onerror=evil()>\n```'}/>);
 await act(async()=>vi.advanceTimersByTime(250));
 expect(view.container.querySelector('img,script')).toBeNull();
 expect(screen.queryAllByRole('link')).toHaveLength(0);
 expect(view.container.querySelector('pre')?.textContent).toContain('<img src=x onerror=evil()>');
 });
 it('renders semantic Markdown and inert image placeholders without active raw HTML',async()=>{
 vi.useFakeTimers(); const {container}=render(<MarkdownPreview content={'# Hello\n\n[good](https://example.com)\n\n![Picture](https://tracking.test/pixel)\n\n<script>evil()</script>\n\n- [x] Done'}/>);
 await act(async()=>vi.advanceTimersByTime(250));
 expect(screen.getByRole('heading',{name:'Hello'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'good'})).toHaveAttribute('rel','noopener noreferrer');
 expect(container.querySelector('img,script')).toBeNull();
 expect(screen.getByText('Picture')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Open image source'})).toHaveAttribute('href','https://tracking.test/pixel');
 expect(screen.getByRole('checkbox')).toBeDisabled();
 });
 it('drops a prior render immediately on changed draft and debounces its replacement',async()=>{
 vi.useFakeTimers(); const view=render(<MarkdownPreview content='# Old'/>);
 await act(async()=>vi.advanceTimersByTime(250));
 expect(screen.getByRole('heading',{name:'Old'})).toBeInTheDocument();
 view.rerender(<MarkdownPreview content='# New'/>);
 expect(screen.queryByRole('heading',{name:'Old'})).toBeNull();
 await act(async()=>vi.advanceTimersByTime(250));
 expect(screen.getByRole('heading',{name:'New'})).toBeInTheDocument();
 });
 it('bounds preview source and exposes source-safe diagram opt-in',async()=>{
 vi.useFakeTimers(); const view=render(<MarkdownPreview content={'x'.repeat(262145)}/>);
 await act(async()=>vi.advanceTimersByTime(250));
 expect(screen.getByText(/Preview limit reached/)).toBeInTheDocument();
 view.rerender(<MarkdownPreview content={'```mermaid\ngraph TD\nA-->B\n```'}/>);
 await act(async()=>vi.advanceTimersByTime(250));
 expect(screen.getByRole('button',{name:'Render diagram'})).toBeInTheDocument();
 expect(view.container.querySelector('iframe')).toBeNull();
 });
});

it('activates eligible wiki references as buttons while excluded syntax stays inert',async()=>{
 vi.useFakeTimers(); const activate=vi.fn();
 render(<MarkdownPreview content={'[[Target|Read target]] `[[Code]]` \\[[Escaped]] ![[Embed]]'} onWikiLink={activate}/>);
 await act(async()=>vi.advanceTimersByTime(250));
 const button=screen.getByRole('button',{name:'Read target'});
 fireEvent.click(button); expect(activate).toHaveBeenCalledWith('Target');
 expect(screen.getAllByRole('button')).toHaveLength(1);
});

it('preserves surrounding text and spaces around wiki controls',async()=>{
 vi.useFakeTimers();const view=render(<MarkdownPreview content='Before [[Target]] after' onWikiLink={vi.fn()}/>);await act(async()=>vi.advanceTimersByTime(250));expect(view.container.textContent).toBe('Before Target after');
});
it('keeps wiki syntax as ordinary text when knowledge rollout is disabled',async()=>{
 vi.useFakeTimers();render(<MarkdownPreview content='[[Target]]'/>);await act(async()=>vi.advanceTimersByTime(250));expect(screen.getByText('[[Target]]')).toBeInTheDocument();expect(screen.queryByRole('button')).toBeNull();
});

it('renders source-spanning wiki tokens with labels as plain text',async()=>{
 vi.useFakeTimers();render(<MarkdownPreview content='[[Under_score_title|**literal label**]]' onWikiLink={vi.fn()}/>);await act(async()=>vi.advanceTimersByTime(250));expect(screen.getByRole('button',{name:'**literal label**'})).toBeInTheDocument();expect(screen.queryByText('literal label',{selector:'strong'})).toBeNull();
});
