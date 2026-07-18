import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "./Icon";

function reactNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return reactNodeText(node.props.children);
  return "";
}

function safeMessageUrl(value?: string): string {
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    const protocol = new URL(value).protocol;
    const allowed = protocol === "http:" || protocol === "https:" || protocol === "mailto:" || protocol === "tel:";
    return allowed ? value : "";
  } catch {
    return "";
  }
}

async function copyRichText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Copy failed");
}

function RichCopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const value = text.trim();
  if (!value) return null;

  const onCopy = async () => {
    try {
      await copyRichText(value);
      setState("copied");
      window.setTimeout(() => setState("idle"), 1400);
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 1800);
    }
  };

  return (
    <button
      className={`message-rich-copy ${state}`}
      type="button"
      onClick={() => void onCopy()}
      aria-label={label}
      title={state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
    >
      <Icon name={state === "copied" ? "check" : "copy"} size={13} />
      <span>{state === "copied" ? "Copied" : state === "failed" ? "Retry" : label}</span>
    </button>
  );
}

export function TelegramMarkdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`telegram-message ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => safeMessageUrl(url)}
        components={{
          a: ({ href, children }) => {
            const safeHref = safeMessageUrl(href);
            return safeHref ? (
              <a href={safeHref} target="_blank" rel="noopener noreferrer">{children}</a>
            ) : <span className="message-unsafe-link">{children}</span>;
          },
          blockquote: ({ children }) => {
            const quoteText = reactNodeText(children);
            return (
              <div className="message-rich-quote">
                <blockquote>{children}</blockquote>
                <RichCopyButton text={quoteText} label="Copy quote" />
              </div>
            );
          },
          pre: ({ children }) => {
            const codeText = reactNodeText(children).replace(/\n$/, "");
            return (
              <div className="message-rich-code">
                <RichCopyButton text={codeText} label="Copy code" />
                <pre>{children}</pre>
              </div>
            );
          },
          table: ({ children }) => (
            <div className="message-table-scroll" tabIndex={0} role="region" aria-label="Message table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
