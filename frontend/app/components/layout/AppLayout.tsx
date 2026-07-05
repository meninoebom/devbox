import { NavLink, Outlet } from "react-router";
import { InspectorProvider, useInspector, httpDetail } from "~/components/inspector/InspectorContext";
import { InspectorPanel } from "~/components/inspector/InspectorPanel";
import { Button } from "~/components/ui/button";
import {
  Globe,
  FileCode2,
  FormInput,
  Database,
  Shield,
  Pencil,
  Layers,
  Box,
  FlaskConical,
  BookOpen,
} from "lucide-react";

const workshopGroups = [
  {
    label: "Bench",
    items: [
      { to: "/workbench", icon: FlaskConical, label: "Workbench" },
      { to: "/guides", icon: BookOpen, label: "Field Guides" },
    ],
  },
  {
    label: "Foundations",
    items: [
      { to: "/workshops/http", icon: Globe, label: "HTTP Observatory" },
      { to: "/workshops/types", icon: FileCode2, label: "Type Bridge" },
      { to: "/workshops/forms", icon: FormInput, label: "Form Workshop" },
    ],
  },
  {
    label: "Data Flow",
    items: [
      { to: "/workshops/data", icon: Database, label: "Data Pipeline" },
      { to: "/workshops/responses", icon: Layers, label: "Response Unwrapper" },
      { to: "/workshops/schema", icon: Box, label: "Schema Forge" },
    ],
  },
  {
    label: "Security & Design",
    items: [
      { to: "/workshops/auth", icon: Shield, label: "Authentication Lab" },
      { to: "/workshops/api-design", icon: Pencil, label: "API Design Studio" },
    ],
  },
];

function InspectorToggle() {
  const { setOpen, trace } = useInspector();
  const status = httpDetail(trace)?.response_status;
  return (
    <Button
      onClick={() => setOpen(true)}
      variant="outline"
      size="sm"
      className="fixed bottom-4 right-4 z-50 font-mono text-xs bg-[#1a1a1a] border-[#2a2a2a] text-amber-400 hover:bg-[#2a2a2a] hover:text-amber-300"
    >
      {status ? `Inspector [${status}]` : "Inspector"}
    </Button>
  );
}

function LayoutInner() {
  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 w-64 h-screen bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col z-40">
        <NavLink
          to="/"
          className="px-5 py-5 border-b border-[#2a2a2a] flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <span className="text-amber-400 font-mono text-xs font-bold">D</span>
          </div>
          <span className="font-mono text-lg font-bold text-neutral-100">
            Dev<span className="text-amber-400">Box</span>
          </span>
        </NavLink>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {workshopGroups.map((group) => (
            <div key={group.label}>
              <h3 className="text-[10px] uppercase tracking-widest text-neutral-600 px-2 mb-2">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2 py-2 rounded text-sm transition-colors ${
                          isActive
                            ? "bg-amber-500/10 text-amber-400 border-l-2 border-amber-400 pl-[6px]"
                            : "text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1a1a]"
                        }`
                      }
                    >
                      <item.icon size={16} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-[#2a2a2a] text-[10px] text-neutral-600 font-mono">
          DevBox v0.1.0
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 min-h-screen">
        <Outlet />
      </main>

      <InspectorToggle />
      <InspectorPanel />
    </div>
  );
}

export function AppLayout() {
  return (
    <InspectorProvider>
      <LayoutInner />
    </InspectorProvider>
  );
}
