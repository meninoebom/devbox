import { Badge } from "~/components/ui/badge";

interface StatusBadgeProps {
  code: number;
  className?: string;
}

export function StatusBadge({ code, className = "" }: StatusBadgeProps) {
  let color = "bg-neutral-700 text-neutral-300";
  if (code >= 200 && code < 300) color = "bg-green-900/50 text-green-400 border-green-800";
  else if (code >= 300 && code < 400) color = "bg-blue-900/50 text-blue-400 border-blue-800";
  else if (code >= 400 && code < 500) color = "bg-amber-900/50 text-amber-400 border-amber-800";
  else if (code >= 500) color = "bg-red-900/50 text-red-400 border-red-800";

  return (
    <Badge variant="outline" className={`font-mono ${color} ${className}`}>
      {code}
    </Badge>
  );
}
