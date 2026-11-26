import React from 'react';
import { cn } from '../../utils/cn';
import { parseMarkdown, type BlockNode, type InlineNode } from '../../utils/markdown';

export interface MarkdownTextProps {
  source: string;
  /** Called when a link (https) is clicked; the host opens it in the system browser. */
  onOpenLink?: (href: string) => void;
}

/** Monospace chip; `em` keeps it proportional to the surrounding text size. */
const CODE_CLASS = 'rounded-sm bg-white/10 px-1.5 py-px font-mono text-[0.875em]';

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
          <code key={i} className={CODE_CLASS}>
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
            className="cursor-pointer text-accent-cyan underline"
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

/** Font size per heading level (h1…h6). */
const HEADING_SIZES = ['text-lg', 'text-base', 'text-md', 'text-sm', 'text-ui', 'text-ui'];

function renderBlock(block: BlockNode, i: number, onOpenLink: MarkdownTextProps['onOpenLink']) {
  switch (block.type) {
    case 'heading':
      return (
        <div
          key={i}
          role="heading"
          aria-level={block.level}
          className={cn('mt-2.5 mb-1 font-extrabold text-fg', HEADING_SIZES[block.level - 1])}
        >
          {renderInline(block.children, onOpenLink)}
        </div>
      );
    case 'paragraph':
      return (
        <p key={i} className="mb-2 leading-relaxed">
          {renderInline(block.children, onOpenLink)}
        </p>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className={cn('mb-2 ps-5 leading-relaxed', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, j) => (
            <li key={j} style={{ marginLeft: `${item.indent}rem` }}>
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
          className="mb-2 border-l-3 border-accent-purple px-3 py-1 text-fg-muted"
        >
          {renderInline(block.children, onOpenLink)}
        </blockquote>
      );
    case 'code':
      return (
        <pre
          key={i}
          className={cn(CODE_CLASS, 'mb-2 block overflow-x-auto px-2.5 py-2 whitespace-pre')}
        >
          {block.text}
        </pre>
      );
    case 'rule':
      return (
        <hr
          key={i}
          className="my-2.5 border-0 border-t border-line"
        />
      );
  }
}

/** Renders Markdown (release notes) as styled React elements, without `innerHTML`. */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ source, onOpenLink }) => {
  const blocks = React.useMemo(() => parseMarkdown(source), [source]);
  return (
    <div className="text-ui text-fg-secondary">
      {blocks.map((block, i) => renderBlock(block, i, onOpenLink))}
    </div>
  );
};
