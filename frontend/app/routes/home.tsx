import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Globe,
  FileCode2,
  FormInput,
  Database,
  Shield,
  Pencil,
  Layers,
  Box,
  ArrowRight,
  Server,
  Code2,
  Workflow,
  FlaskConical,
  BookOpen,
} from "lucide-react";

export function meta() {
  return [
    { title: "DevBox - Interactive Engineering Playground" },
    { name: "description", content: "Learn how modern web apps work by building one" },
  ];
}

const workshops = [
  {
    to: "/workshops/http",
    icon: Globe,
    title: "HTTP Observatory",
    desc: "Send requests, inspect headers, explore status codes",
    tags: ["GET", "POST", "Headers", "Status Codes"],
  },
  {
    to: "/workshops/types",
    icon: FileCode2,
    title: "Type Bridge",
    desc: "See how Python types become TypeScript types",
    tags: ["Pydantic", "OpenAPI", "Validation"],
  },
  {
    to: "/workshops/forms",
    icon: FormInput,
    title: "Form Workshop",
    desc: "Compare JSON, form-encoded, and multipart submissions",
    tags: ["JSON", "FormData", "Upload"],
  },
  {
    to: "/workshops/data",
    icon: Database,
    title: "Data Pipeline",
    desc: "CRUD operations with full request lifecycle visibility",
    tags: ["CRUD", "Pagination", "REST"],
  },
  {
    to: "/workshops/auth",
    icon: Shield,
    title: "Authentication Lab",
    desc: "JWT tokens, registration, login flows decoded",
    tags: ["JWT", "Tokens", "Sessions"],
  },
  {
    to: "/workshops/api-design",
    icon: Pencil,
    title: "API Design Studio",
    desc: "Explore route design, error patterns, documentation",
    tags: ["REST", "Errors", "Routes"],
  },
  {
    to: "/workshops/responses",
    icon: Layers,
    title: "Response Unwrapper",
    desc: "Step through the lifecycle of an API response",
    tags: ["Transform", "Parsing", "Pipeline"],
  },
  {
    to: "/workshops/schema",
    icon: Box,
    title: "Schema Forge",
    desc: "Browse data models and their relationships",
    tags: ["Models", "Relations", "ER"],
  },
];

const stackLayers = [
  { label: "React + Router", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  { label: "HTTP / fetch()", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  { label: "FastAPI", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  { label: "SQLAlchemy + SQLite", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="border-b border-[#2a2a2a] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <span className="text-amber-400 font-mono text-lg font-bold">D</span>
                </div>
                <span className="font-mono text-2xl font-bold text-neutral-100">
                  Dev<span className="text-amber-400">Box</span>
                </span>
              </div>
              <h1 className="text-4xl font-mono font-bold text-neutral-100 mb-4 leading-tight">
                Learn how web apps work
                <br />
                <span className="text-amber-400">by inspecting one.</span>
              </h1>
              <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
                Every surface is peelable. See the HTTP, the serialization,
                the SQL queries, the types -- all in real time.
              </p>
              <Link to="/workshops/http">
                <Button className="bg-amber-500 text-black hover:bg-amber-400 font-mono">
                  Start Exploring <ArrowRight className="ml-2" size={16} />
                </Button>
              </Link>
            </div>

            {/* Stack Diagram */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-widest text-neutral-600 font-mono mb-4">
                The Stack
              </h3>
              {stackLayers.map((layer, i) => (
                <div
                  key={layer.label}
                  className={`border rounded-lg px-5 py-4 flex items-center gap-3 ${layer.bg}`}
                >
                  <div className={`font-mono text-sm font-medium ${layer.color}`}>
                    {layer.label}
                  </div>
                  {i < stackLayers.length - 1 && (
                    <Workflow size={14} className="text-neutral-600 ml-auto" />
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 mt-4 text-[11px] text-neutral-600 font-mono">
                <Server size={12} />
                <span>Every layer inspectable via the trace panel</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The Bench */}
      <div className="max-w-6xl mx-auto px-8 pt-12">
        <h2 className="text-xs uppercase tracking-widest text-neutral-600 font-mono mb-6">
          The Bench
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/workbench">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a] hover:border-amber-500/30 transition-colors h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <FlaskConical size={18} className="text-amber-400" />
                  <CardTitle className="text-sm font-mono text-neutral-200">Workbench</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500 text-sm">
                  Paste a query, run it against the lab database, read the plan. The
                  instrument for "why is this slow?"
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/guides">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a] hover:border-amber-500/30 transition-colors h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <BookOpen size={18} className="text-amber-400" />
                  <CardTitle className="text-sm font-mono text-neutral-200">Field Guides</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-neutral-500 text-sm">
                  Reference reading on encoding, context, and cryptography, kept at
                  one address.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Workshop Cards */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        <h2 className="text-xs uppercase tracking-widest text-neutral-600 font-mono mb-6">
          Workshops
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workshops.map((w) => (
            <Link key={w.to} to={w.to}>
              <Card className="bg-[#1a1a1a] border-[#2a2a2a] hover:border-amber-500/30 transition-colors h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <w.icon size={18} className="text-amber-400" />
                    <CardTitle className="text-sm font-mono text-neutral-200">
                      {w.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-500 text-sm mb-3">{w.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {w.tags.map((tag) => (
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
            </Link>
          ))}
        </div>

        {/* Footer hint */}
        <div className="mt-12 text-center text-neutral-600 text-xs font-mono flex items-center justify-center gap-2">
          <Code2 size={12} />
          <span>Every API call populates the Inspector panel -- try it</span>
        </div>
      </div>
    </div>
  );
}
