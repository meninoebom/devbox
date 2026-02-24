interface CodeBlockProps {
  children: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ children, language, className = "" }: CodeBlockProps) {
  return (
    <div className={`relative rounded-md ${className}`}>
      {language && (
        <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
          {language}
        </span>
      )}
      <pre className="bg-[#111] border border-[#2a2a2a] rounded-md p-4 overflow-x-auto text-sm">
        <code className="font-mono text-neutral-300">{children}</code>
      </pre>
    </div>
  );
}
