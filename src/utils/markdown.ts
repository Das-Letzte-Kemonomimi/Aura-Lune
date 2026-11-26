/**
 * Minimalny parser Markdown dla notatek wydań GitHuba (nagłówki, listy, cytaty, bloki kodu,
 * pogrubienie, kursywa, kod w linii, linki). Zwraca drzewo danych — renderuje je komponent
 * `MarkdownText` jako elementy Reacta, więc surowy HTML z notatek nigdy nie trafia do DOM.
 */

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'code'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'strike'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] };

export type BlockNode =
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: { indent: number; children: InlineNode[] }[] }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'rule' };

const INLINE =
  /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|~~([^~\n]+?)~~|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*\s][^*\n]*?)\*|(https?:\/\/[^\s<>)]+[^\s<>).,;:!?])/g;

export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push({ type: 'text', text: source.slice(last, index) });
    const [, code, bold, strike, linkText, linkHref, italic, bare] = match;
    if (code !== undefined) nodes.push({ type: 'code', text: code });
    else if (bold !== undefined) nodes.push({ type: 'bold', children: parseInline(bold) });
    else if (strike !== undefined) nodes.push({ type: 'strike', children: parseInline(strike) });
    else if (linkHref !== undefined)
      nodes.push({ type: 'link', href: linkHref, children: parseInline(linkText ?? linkHref) });
    else if (italic !== undefined) nodes.push({ type: 'italic', children: parseInline(italic) });
    else if (bare !== undefined)
      nodes.push({ type: 'link', href: bare, children: [{ type: 'text', text: bare }] });
    last = index + match[0].length;
  }
  if (last < source.length) nodes.push({ type: 'text', text: source.slice(last) });
  return nodes;
}

const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const NUMBERED = /^(\s*)\d+[.)]\s+(.*)$/;

export function parseMarkdown(source: string): BlockNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    if (trimmed === '') {
      flushParagraph();
      continue;
    }
    // Komentarze HTML (np. `<!-- ... -->`) w notatkach nie mają być widoczne.
    if (/^<!--.*-->$/.test(trimmed)) continue;
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'heading', level: heading[1].length, children: parseInline(heading[2]) });
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: 'rule' });
      continue;
    }
    if (trimmed.startsWith('>')) {
      flushParagraph();
      blocks.push({ type: 'quote', children: parseInline(trimmed.replace(/^>\s?/, '')) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = !bullet;
      const indent = Math.floor((bullet ? bullet[1] : numbered![1]).replace(/\t/g, '  ').length / 2);
      const text = bullet ? bullet[3] : numbered![2];
      const previous = blocks[blocks.length - 1];
      if (previous?.type === 'list' && previous.ordered === ordered) {
        previous.items.push({ indent, children: parseInline(text) });
      } else {
        blocks.push({ type: 'list', ordered, items: [{ indent, children: parseInline(text) }] });
      }
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks;
}
