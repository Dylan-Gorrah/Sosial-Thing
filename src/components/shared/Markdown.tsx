// No "use client" — this is a pure render component, works server or client.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

interface Props {
  children: string;
  prose?: boolean; // larger line-height / font size for post bodies
}

export default function Markdown({ children, prose = false }: Props) {
  const baseText: React.CSSProperties = {
    color: "var(--color-text-2)",
    lineHeight: prose ? 1.75 : 1.65,
    fontSize: prose ? 15 : 13.5,
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // Headings — lighter than page chrome so they don't compete
        h1: ({ children }) => (
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 10, marginTop: 20, color: "var(--color-text)" }}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, marginTop: 16, color: "var(--color-text)" }}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6, marginTop: 14, color: "var(--color-text)" }}>{children}</h3>
        ),

        // Paragraph — main reading text
        p: ({ children }) => (
          <p style={{ ...baseText, marginBottom: 12, marginTop: 0 }}>{children}</p>
        ),

        // Links — accent coloured, open in new tab
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-accent)", textDecoration: "underline" }}
          >
            {children}
          </a>
        ),

        // Inline code — small pill, accent tint; block code handled by <pre>
        code: ({ className, children, ...props }: any) => {
          const isBlock = !!className; // remark sets language-* class on block code
          if (!isBlock) {
            return (
              <code
                style={{
                  background: "var(--color-panel-2)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: "0.88em",
                  fontFamily: "ui-monospace, 'Cascadia Code', monospace",
                  color: "var(--color-accent)",
                }}
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={className} style={{ fontSize: 12.5, lineHeight: 1.6, fontFamily: "ui-monospace, 'Cascadia Code', monospace" }} {...props}>
              {children}
            </code>
          );
        },

        // Code block wrapper — dark panel matching the design system
        pre: ({ children }) => (
          <pre
            style={{
              background: "var(--color-panel-2)",
              border: "1px solid var(--color-line)",
              borderRadius: 8,
              padding: "14px 16px",
              overflowX: "auto",
              marginBottom: 14,
              marginTop: 4,
            }}
          >
            {children}
          </pre>
        ),

        // Blockquote — left border accent, muted text
        blockquote: ({ children }) => (
          <blockquote
            style={{
              borderLeft: "3px solid var(--color-accent)",
              paddingLeft: 14,
              margin: "12px 0",
              color: "var(--color-text-3)",
              fontStyle: "italic",
            }}
          >
            {children}
          </blockquote>
        ),

        // Lists
        ul: ({ children }) => (
          <ul style={{ paddingLeft: 22, marginBottom: 12, marginTop: 4, ...baseText }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ paddingLeft: 22, marginBottom: 12, marginTop: 4, ...baseText }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ marginBottom: 3, lineHeight: 1.65 }}>{children}</li>
        ),

        // Horizontal rule
        hr: () => (
          <hr style={{ border: "none", borderTop: "1px solid var(--color-line)", margin: "18px 0" }} />
        ),

        // Emphasis
        strong: ({ children }) => (
          <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>{children}</strong>
        ),
        em: ({ children }) => (
          <em style={{ color: "var(--color-text-2)" }}>{children}</em>
        ),

        // Tables (GFM) — horizontal scroll on small screens
        table: ({ children }) => (
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th style={{ padding: "8px 12px", textAlign: "left", background: "var(--color-panel)", borderBottom: "2px solid var(--color-line)", color: "var(--color-text)", fontWeight: 600 }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--color-line)", color: "var(--color-text-2)" }}>
            {children}
          </td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
