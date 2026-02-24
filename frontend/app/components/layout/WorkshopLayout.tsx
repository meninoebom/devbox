import type { ReactNode } from "react";

interface WorkshopLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function WorkshopLayout({ title, description, children }: WorkshopLayoutProps) {
  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-bold text-neutral-100 mb-2">
          {title}
        </h1>
        <p className="text-neutral-400 text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}
