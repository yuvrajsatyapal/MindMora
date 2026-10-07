import { describe, expect, it } from 'vitest';
import { extractKnowledge, normalizeTitleKey } from './syntax';
describe('portable knowledge grammar', () => {
 it('normalizes titles and aggregates repeated labels and unicode tags', () => {
  expect(normalizeTitleKey('  Ａ  B ')).toBe('a b');
  const result = extractKnowledge('[[ Note |label]] and [[Note]] #Été #été #123 #_');
  expect(result.links).toMatchObject([{ targetKey:'note', targetTitle:'Note', occurrenceCount:2 }]);
  expect(result.tags).toEqual([{tagKey:'été',displayName:'Été'}]);
 });
 it('excludes code, math, HTML, links, images, escaped tokens and embeds', () => {
  const source = '`[[Code]] #code`\n\n```mermaid\n[[Fence]] #fence\n```\n\n$[[Math]] #math$ [link [[Inside]] #inside](https://x/#url) ![image #image](x) <b>[[Html]] #html</b> \\[[Escape]] \\#escaped ![[Embed]] https://x/#fragment\n\n[[Real]] #real';
  expect(extractKnowledge(source).links.map(l=>l.targetTitle)).toEqual(['Real']);
  expect(extractKnowledge(source).tags.map(t=>t.tagKey)).toEqual(['real']);
  expect(extractKnowledge('[[Markdown title]](https://example.invalid) [[Reference]][ref]\n\n[ref]: /url').links).toEqual([]);
 });
 it('recognizes source grammar across emphasis text nodes and treats labels as plain source text',()=>{expect(extractKnowledge('[[Under_score_title|**literal label**]] #tag').links).toMatchObject([{targetKey:'under_score_title',occurrenceCount:1}]);expect(extractKnowledge('[[note|*label*]]').links[0]?.targetTitle).toBe('note');});
 it('keeps prose after void HTML and uses codepoint tag boundaries',()=>{expect(extractKnowledge('Before <br> [[Real]] #real').links[0]?.targetTitle).toBe('Real');expect(extractKnowledge('𝒜#word').tags).toEqual([]);});
 it('keeps portable URL/email title identities and excludes real autolinks',()=>{expect(extractKnowledge('[[person@example.com]] [[https://example.test|URL]] https://example.test/#fragment #tag@example.test').links).toHaveLength(2);expect(extractKnowledge('https://example.test/#fragment #tag@example.test #real').tags.map(t=>t.tagKey)).toEqual(['real']);});
 it('keeps malformed references inert and does not apply preview limits', () => {
  expect(extractKnowledge('[[bad\nline]] [[ ]] [[x'.repeat(2)).links).toEqual([]);
  expect(extractKnowledge('a'.repeat(300000)+' [[Tail]] #tail').links[0].targetKey).toBe('tail');
 });
});
it('keeps enclosing HTML excluded across unmatched or void closing tags',()=>{
 for(const closing of ['br','img','other'])expect(extractKnowledge(`Before <span>first </${closing}> #hidden [[Hidden]]</span> [[Visible]] #visible`)).toMatchObject({links:[{targetTitle:'Visible'}],tags:[{tagKey:'visible'}]});
});
