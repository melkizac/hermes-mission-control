import { lazy, Suspense } from "react";

const TelegramMarkdown = lazy(() => import("./TelegramMarkdown").then((module) => ({ default: module.TelegramMarkdown })));

function containsRichFormatting(text: string) {
  return /(^|\n)\s{0,3}(#{1,6}\s|>|[-+*]\s|\d+[.)]\s|```|\|.+\|)|\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\//m.test(text);
}

export function TelegramMessage({ text, className = "" }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  const classes = `telegram-message ${className}`.trim();
  if (!containsRichFormatting(text)) return <div className={`${classes} plain`}>{text}</div>;
  return (
    <Suspense fallback={<div className={`${classes} plain`}>{text}</div>}>
      <TelegramMarkdown text={text} className={className} />
    </Suspense>
  );
}
