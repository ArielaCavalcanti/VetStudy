import type { ReactNode } from "react";

function inlineMarkdown(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);

  return (
    <div className="space-y-2 text-sm leading-7">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={index} className="h-1" />;

        const heading = /^(#{1,4})\s+(.+)$/.exec(line);
        if (heading) {
          const level = heading[1].length;
          const text = inlineMarkdown(heading[2]);
          if (level === 1) return <h2 key={index} className="pt-3 text-xl font-semibold">{text}</h2>;
          if (level === 2) return <h3 key={index} className="pt-3 text-lg font-semibold">{text}</h3>;
          return <h4 key={index} className="pt-2 font-semibold">{text}</h4>;
        }

        if (/^[-*•]\s+/.test(line)) {
          return <p key={index} className="pl-4 before:mr-2 before:text-primary before:content-['•']">{inlineMarkdown(line.replace(/^[-*•]\s+/, ""))}</p>;
        }

        if (/^\d+[.)]\s+/.test(line)) {
          const numbered = /^(\d+[.)])\s+(.+)$/.exec(line)!;
          return <p key={index} className="pl-4"><span className="mr-2 font-semibold text-primary">{numbered[1]}</span>{inlineMarkdown(numbered[2])}</p>;
        }

        if (line.startsWith("> ")) {
          return <blockquote key={index} className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground">{inlineMarkdown(line.slice(2))}</blockquote>;
        }

        return <p key={index}>{inlineMarkdown(line)}</p>;
      })}
    </div>
  );
}
