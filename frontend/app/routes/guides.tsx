import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { BookOpen, Brain, KeyRound, ExternalLink } from "lucide-react";

export function meta() {
  return [
    { title: "Field Guides - DevBox" },
    { name: "description", content: "Reference reading on encoding, context, and cryptography" },
  ];
}

// Static field guides live in public/field-guides/ and open as their own pages.
// Cleartext is a separate standalone app, linked here for one address.
const guides = [
  {
    href: "/field-guides/encoding.html",
    external: true,
    icon: KeyRound,
    title: "Encoding, Hashing & Encryption",
    desc: "The difference between encoding, hashing, and encryption, shown side by side with worked examples.",
    tags: ["Base64", "SHA-256", "AES"],
  },
  {
    href: "/field-guides/context.html",
    external: true,
    icon: Brain,
    title: "How Claude Remembers",
    desc: "A field guide to context: what an agent holds in working memory, and how that memory is shaped.",
    tags: ["Context", "Memory", "Agents"],
  },
  {
    href: "https://github.com/meninoebom/cleartext-encryption-game",
    external: true,
    icon: KeyRound,
    title: "Cleartext (standalone)",
    desc: "A cryptography puzzle game: learn each tool by facing the threat it was invented to solve. Runs on its own.",
    tags: ["Game", "Crypto", "Standalone"],
  },
];

export default function Guides() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <div className="flex items-center gap-2.5 mb-2">
        <BookOpen size={20} className="text-amber-400" />
        <h1 className="text-2xl font-mono font-bold text-neutral-100">Field Guides</h1>
      </div>
      <p className="text-neutral-500 text-sm mb-8 max-w-2xl">
        Reference reading, kept at one address. These are the durable explainers you
        consult, not lessons you complete.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {guides.map((g) => (
          <a
            key={g.href}
            href={g.href}
            target="_blank"
            rel="noreferrer"
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg"
          >
            <Card className="bg-[#1a1a1a] border-[#2a2a2a] hover:border-amber-500/30 transition-colors h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <g.icon size={18} className="text-amber-400" />
                  <CardTitle className="text-sm font-mono text-neutral-200 flex items-center gap-1.5">
                    {g.title}
                    <ExternalLink size={12} className="text-neutral-600" />
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500 text-sm mb-3">{g.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] border-[#2a2a2a] text-neutral-500 font-mono"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
