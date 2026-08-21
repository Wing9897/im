import type { AssistantMdBlock, AssistantMdInline } from "../../domain/assistant/assistantMarkdown";
import { parseAssistantMarkdown } from "../../domain/assistant/assistantMarkdown";

function headingClass(level: 1 | 2 | 3): string {
  if (level === 1) {
    return "m-0 text-page-title font-semibold leading-snug text-text-primary";
  }
  if (level === 2) {
    return "m-0 text-section-title font-semibold leading-snug text-text-primary";
  }
  return "m-0 text-card-title font-medium leading-snug text-text-primary";
}

function InlineNodes({ nodes }: { nodes: readonly AssistantMdInline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "text") {
          return <span key={index}>{node.value}</span>;
        }
        if (node.type === "code") {
          return (
            <code
              key={index}
              className="rounded-sm bg-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] px-0.5 font-mono text-[0.92em]"
            >
              {node.value}
            </code>
          );
        }
        if (node.type === "link") {
          return (
            <a
              key={index}
              href={node.href}
              target="_blank"
              rel="noopener"
              className="text-accent underline underline-offset-2"
            >
              <InlineNodes nodes={node.children} />
            </a>
          );
        }
        return (
          <strong key={index} className="font-semibold">
            <InlineNodes nodes={node.children} />
          </strong>
        );
      })}
    </>
  );
}

function BlockView({ block }: { block: AssistantMdBlock }) {
  if (block.type === "heading") {
    const Tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : "h3";
    return (
      <Tag className={headingClass(block.level)}>
        <InlineNodes nodes={block.children} />
      </Tag>
    );
  }
  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag
        className={`${block.ordered ? "list-decimal" : "list-disc"} m-0 list-inside pl-0`}
      >
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>
            <InlineNodes nodes={item} />
          </li>
        ))}
      </ListTag>
    );
  }
  return (
    <p className="m-0">
      <InlineNodes nodes={block.children} />
    </p>
  );
}

type AssistantMarkdownProps = {
  text: string;
  className?: string;
};

/**
 * Render the assistant Markdown subset as React nodes only (never HTML).
 */
export function AssistantMarkdown({ text, className }: AssistantMarkdownProps) {
  const blocks = parseAssistantMarkdown(text);
  return (
    <div
      className={["flex flex-col gap-1.5 break-words", className].filter(Boolean).join(" ")}
      data-testid="assistant-markdown"
    >
      {blocks.length === 0
        ? null
        : blocks.map((block, index) => (
            <BlockView key={index} block={block} />
          ))}
    </div>
  );
}
