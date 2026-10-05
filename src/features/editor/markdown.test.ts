import { describe, expect, it } from "vitest";
import { parseMarkdown, safeMarkdownUrl } from "./markdown";
describe("Markdown boundary", () => {
  it("rejects densely delimited or excessive-line source before expensive parsing", () => {
    expect(parseMarkdown("* ".repeat(2001))).toEqual({limited:true});
    expect(parseMarkdown("\n".repeat(5001))).toEqual({limited:true});
  });
  it("parses semantic Markdown and GFM while dropping raw HTML", () => {
    const result = parseMarkdown('# Heading\n\n<script>alert(1)</script>\n\n| A | B |\n| - | - |\n| a | b |\n\n- [x] done\n\n```js\n<img onerror=evil>\n```');
    expect(JSON.stringify(result)).toContain('"tagName":"h1"');
    expect(JSON.stringify(result)).toContain('"tagName":"table"');
    expect(JSON.stringify(result)).not.toContain('"tagName":"script"');
    expect(JSON.stringify(result)).toContain('<img onerror=evil>');
  });
  it("bounds UTF8 source and AST work independently from saving", () => {
    expect(parseMarkdown('🙂'.repeat(65537))).toEqual({ limited: true });
    expect(parseMarkdown('*x* '.repeat(10000))).toEqual({ limited: true });
  });
  it("permits deliberate HTTPS and local navigation only", () => {
    for (const value of ['https://example.com/a', '/workspace?x=1', '#heading', './guide', 'guide.md']) expect(safeMarkdownUrl(value)).toBe(value);
    for (const value of ['javascript:evil', 'java\nscript:evil', '//evil.com', 'https://u:p@evil.com', 'data:image/png,x', '%6aavascript:evil', '&#106;avascript:evil', '\\evil.com', '/\\evil.com', 'https://example.com/%0aevil']) expect(safeMarkdownUrl(value)).toBeUndefined();
  });
});
