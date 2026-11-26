// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('parses headings, lists and paragraphs of a GitHub release body', () => {
    const blocks = parseMarkdown(
      '## What\'s Changed\n* Fix **chords** by @user in https://github.com/o/r/pull/1\n* Add `dev_server`\n\nPlain text\nsecond line\n\n1. one\n2. two',
    );
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'list', 'paragraph', 'list']);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2 });
    expect(blocks[1]).toMatchObject({ type: 'list', ordered: false });
    expect((blocks[1] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[3]).toMatchObject({ type: 'list', ordered: true });
    const paragraph = blocks[2] as { children: { type: string; text?: string }[] };
    expect(paragraph.children[0].text).toBe('Plain text second line');
  });

  it('keeps fenced code verbatim and ignores HTML comments', () => {
    const blocks = parseMarkdown('<!-- hidden -->\n```bash\ncurl -fsSL x | bash\n# not a heading\n```\n---');
    expect(blocks).toEqual([{ type: 'code', text: 'curl -fsSL x | bash\n# not a heading' }, { type: 'rule' }]);
  });

  it('records nesting depth of list items', () => {
    const [list] = parseMarkdown('- a\n  - b');
    expect((list as { items: { indent: number }[] }).items.map((i) => i.indent)).toEqual([0, 1]);
  });
});

describe('parseInline', () => {
  it('handles bold, italic, code, links and bare URLs', () => {
    const nodes = parseInline('**b** *i* `c` [t](https://a.io/x) see https://b.io/y.');
    expect(nodes.map((n) => n.type)).toEqual(['bold', 'text', 'italic', 'text', 'code', 'text', 'link', 'text', 'link', 'text']);
    expect(nodes[8]).toMatchObject({ type: 'link', href: 'https://b.io/y' });
  });

  it('does not treat snake_case or raw HTML as markup and refuses non-http links', () => {
    expect(parseInline('dev_server_kind')).toEqual([{ type: 'text', text: 'dev_server_kind' }]);
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([
      { type: 'text', text: '<img src=x onerror=alert(1)>' },
    ]);
    expect(parseInline('[x](javascript:alert(1))').some((n) => n.type === 'link')).toBe(false);
  });
});
