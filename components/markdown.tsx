import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Raw HTML in markdown is not rendered (react-markdown default), so GitHub content is safe to display.
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-link-blue underline-offset-2 hover:underline">
      {children}
    </a>
  ),
  h1: ({ children }) => <h3 className="mb-2 mt-4 text-heading-5 text-ink first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-4 text-heading-5 text-ink first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-1 mt-3 text-body-md font-medium text-ink first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1 mt-3 text-body-sm font-medium text-ink first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-hairline pl-3 text-slate">{children}</blockquote>,
  code: ({ children }) => <code className="rounded-xs bg-surface px-1 font-mono text-caption">{children}</code>,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-sm bg-surface p-3 font-mono text-caption [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  img: ({ src, alt }) => (
    <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" className="my-2 max-w-full rounded-sm border border-hairline" />
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-caption">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-hairline bg-surface px-2 py-1 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border border-hairline px-2 py-1">{children}</td>,
  hr: () => <hr className="my-4 border-hairline" />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="min-w-0 break-words text-body-sm text-charcoal">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
