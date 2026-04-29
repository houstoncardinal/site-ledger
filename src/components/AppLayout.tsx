import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Plus, Receipt } from "lucide-react";
import { useState } from "react";
import QuickAddSheet from "./QuickAddSheet";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/transactions", label: "Transactions", icon: Receipt },
];

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 bg-surface-dark text-surface-dark-foreground flex-col border-r border-border">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center font-display font-bold text-white text-lg shadow-red">
              B
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">BuildLedger</div>
              <div className="text-xs text-white/50 mt-1">Field Finance OS</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-red"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )
              }
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <button
            onClick={() => setOpen(true)}
            className="w-full bg-gradient-primary text-primary-foreground font-semibold py-3 rounded-lg flex items-center justify-center gap-2 shadow-red hover:opacity-95 transition"
          >
            <Plus className="w-4 h-4" /> Quick Add
          </button>
        </div>
        <div className="h-2 industrial-stripe" />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden bg-surface-dark text-surface-dark-foreground p-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-primary flex items-center justify-center font-display font-bold text-white text-sm">
            B
          </div>
          <span className="font-display font-bold">BuildLedger</span>
        </div>
        <div className="text-xs uppercase tracking-wider text-white/60">
          {loc.pathname === "/" ? "Dashboard" : loc.pathname.slice(1)}
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface-dark border-t border-white/10 z-40">
        <div className="grid grid-cols-4 relative">
          {nav.slice(0, 2).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center py-3 text-xs gap-1",
                  isActive ? "text-primary" : "text-white/60"
                )
              }
            >
              <n.icon className="w-5 h-5" />
              {n.label}
            </NavLink>
          ))}
          <button
            onClick={() => setOpen(true)}
            className="flex flex-col items-center justify-center -mt-6"
            aria-label="Quick add"
          >
            <span className="w-14 h-14 rounded-full bg-gradient-primary text-white flex items-center justify-center shadow-red">
              <Plus className="w-6 h-6" />
            </span>
          </button>
          <NavLink
            to="/transactions"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center py-3 text-xs gap-1",
                isActive ? "text-primary" : "text-white/60"
              )
            }
          >
            <Receipt className="w-5 h-5" />
            Logs
          </NavLink>
        </div>
      </nav>

      <QuickAddSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
