import React from 'react';
import { parseMarkdown, type BlockNode, type InlineNode } from '../../utils/markdown';

export interface MarkdownTextProps {
  source: string;
  /** Wywoływane po kliknięciu linku (https) — host otwiera go w przeglądarce systemowej. */
  onOpenLink?: (href: string) => void;
}

const CODE_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.92em',
  padding: '1px 5px',
  borderRadius: '4px',
  background: 'rgba(255, 255, 255, 0.1)',
};

function renderInline(
  nodes: InlineNode[],
  onOpenLink: MarkdownTextProps['onOpenLink'],
): React.ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <React.Fragment key={i}>{node.text}</React.Fragment>;
      case 'code':
        return (
          <code key={i} style={CODE_STYLE}>
            {node.text}
          </code>
        );
      case 'bold':
        return <strong key={i}>{renderInline(node.children, onOpenLink)}</strong>;
      case 'italic':
        return <em key={i}>{renderInline(node.children, onOpenLink)}</em>;
      case 'strike':
        return <s key={i}>{renderInline(node.children, onOpenLink)}</s>;
      case 'link':
        return (
          <a
            key={i}
            href={node.href}
            style={{ color: 'var(--accent-cyan)', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={(e) => {
              e.preventDefault();
              onOpenLink?.(node.href);
            }}
          >
            {renderInline(node.children, onOpenLink)}
          </a>
        );
    }
  });
}

const HEADING_SIZES = ['1.15rem', '1.05rem', '0.95rem', '0.88rem', '0.82rem', '0.8rem'];

function renderBlock(block: BlockNode, i: number, onOpenLink: MarkdownTextProps['onOpenLink']) {
  switch (block.type) {
    case 'heading':
      return (
        <div
          key={i}
          role="heading"
          aria-level={block.level}
          style={{
            fontSize: HEADING_SIZES[block.level - 1],
            fontWeight: 800,
            color: '#fff',
            margin: '10px 0 4px',
          }}
        >
          {renderInline(block.children, onOpenLink)}
        </div>
      );
    case 'paragraph':
      return (
        <p key={i} style={{ margin: '0 0 8px', lineHeight: 1.6 }}>
          {renderInline(block.children, onOpenLink)}
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} style={{ margin: '0 0 8px', paddingLeft: '20px', lineHeight: 1.6 }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ marginLeft: `${item.indent * 16}px` }}>
              {renderInline(item.children, onOpenLink)}
            </li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote
          key={i}
          style={{
            margin: '0 0 8px',
            padding: '4px 12px',
            borderLeft: '3px solid var(--accent-purple)',
            color: 'var(--text-muted)',
          }}
        >
          {renderInline(block.children, onOpenLink)}
        </blockquote>
      );
    case 'code':
      return (
        <pre
          key={i}
          style={{
            ...CODE_STYLE,
            display: 'block',
            padding: '8px 10px',
            margin: '0 0 8px',
            overflowX: 'auto',
            whiteSpace: 'pre',
          }}
        >
          {block.text}
        </pre>
      );
    case 'rule':
      return (
        <hr
          key={i}
          style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }}
        />
      );
  }
}

/** Renderuje Markdown (notatki wydań) jako stylowane elementy Reacta — bez `innerHTML`. */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ source, onOpenLink }) => {
  const blocks = React.useMemo(() => parseMarkdown(source), [source]);
  return (
    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
      {blocks.map((block, i) => renderBlock(block, i, onOpenLink))}
    </div>
  );
};
