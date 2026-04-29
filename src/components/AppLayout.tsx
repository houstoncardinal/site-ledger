import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Plus, Receipt, Wallet,
  Image, WifiOff, BarChart2, HelpCircle,
} from "lucide-react";
import { useState } from "react";
import QuickAddSheet from "./QuickAddSheet";
import HelpPanel from "./HelpPanel";
import { cn } from "@/lib/utils";
import { useOfflineSync, useIsOnline } from "@/hooks/useOfflineSync";
import { isAIEnabled } from "@/lib/openai";

const NAV_OVERVIEW = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/analytics", label: "Intelligence", icon: BarChart2, badge: "AI" },
];

const NAV_MANAGE = [
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/receipts", label: "Receipts", icon: Image },
  { to: "/accounts", label: "Accounts", icon: Wallet },
];

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/analytics": "Intelligence",
  "/projects": "Projects",
  "/transactions": "Transactions",
  "/receipts": "Receipts",
  "/accounts": "Accounts",
};

function NavItem({ to, label, icon: Icon, end, badge }: { to: string; label: string; icon: any; end?: boolean; badge?: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
          isActive
            ? "bg-white/[0.09] text-white"
            : "text-white/45 hover:bg-white/[0.05] hover:text-white/80"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("w-[15px] h-[15px] shrink-0 transition-colors", isActive ? "text-white" : "text-white/35")} />
          <span className="flex-1">{label}</span>
          {badge && (
            <span className="text-[9px] font-bold bg-primary/80 text-white px-1.5 py-0.5 rounded-full leading-none tracking-wide">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const [addOpen, setAddOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const loc = useLocation();
  const { pendingCount } = useOfflineSync();
  const online = useIsOnline();
  const aiEnabled = isAIEnabled();

  const pageLabel = PAGE_LABELS[loc.pathname] ?? loc.pathname.split("/")[1] ?? "HOU INC";

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex md:w-[220px] flex-col shrink-0 border-r border-white/[0.06]" style={{ background: "#0a0a0a" }}>

        {/* Wordmark */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 shrink-0">
              <span className="font-display font-black text-white text-[11px] leading-none tracking-tight">HOU</span>
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-display font-bold text-[14px] text-white tracking-tight">HOU INC</div>
              <div className="text-[10px] text-white/30 font-medium tracking-wide">Bookkeeper AI</div>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setAddOpen(true)}
            className="w-full h-9 rounded-xl bg-red-500 hover:bg-red-500/90 active:bg-red-600 text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md shadow-red-500/20"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            New Entry
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 overflow-y-auto space-y-4 pb-2">
          {/* Overview group */}
          <div>
            <div className="px-3 mb-1">
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.12em]">Overview</span>
            </div>
            <div className="space-y-0.5">
              {NAV_OVERVIEW.map((n) => <NavItem key={n.to} {...n} />)}
            </div>
          </div>

          {/* Manage group */}
          <div>
            <div className="px-3 mb-1">
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.12em]">Manage</span>
            </div>
            <div className="space-y-0.5">
              {NAV_MANAGE.map((n) => <NavItem key={n.to} {...n} />)}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/[0.06] space-y-1.5">
          {/* Offline / sync badge */}
          {(!online || pendingCount > 0) && (
            <div className={cn(
              "flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium",
              !online ? "bg-yellow-500/10 text-yellow-400" : "bg-emerald-500/10 text-emerald-400"
            )}>
              <WifiOff className="w-3 h-3 shrink-0" />
              {!online ? "Offline — entries queued" : `${pendingCount} pending sync`}
            </div>
          )}

          {/* Bottom actions row */}
          <div className="flex items-center justify-between px-1">
            {aiEnabled ? (
              <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AI active
              </div>
            ) : (
              <div className="text-[10px] text-white/15">AI disabled</div>
            )}
            <button
              onClick={() => setHelpOpen(true)}
              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/70 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Help
            </button>
          </div>
        </div>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <header className="md:hidden sticky top-0 z-30 border-b border-white/[0.06]" style={{ background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-3 px-4 h-14">
          {/* Logo mark */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shrink-0">
            <span className="font-display font-black text-white text-[9px] tracking-tight">HOU</span>
          </div>

          {/* Page title */}
          <span className="font-display font-semibold text-white text-[14px] flex-1 truncate">{pageLabel}</span>

          {/* Sync badge */}
          {(!online || pendingCount > 0) && (
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
              !online ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"
            )}>
              {!online ? "Offline" : `${pendingCount}↑`}
            </span>
          )}

          {/* Help */}
          <button
            onClick={() => setHelpOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.07] transition-colors shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Add */}
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3.5 bg-red-500 hover:bg-red-500/90 active:bg-red-600 rounded-xl text-white font-bold text-[12px] transition-all shadow-md shadow-red-500/30 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Add
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0 overflow-x-hidden">
        <Outlet />
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06]"
        style={{ background: "rgba(10,10,10,0.96)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      >
        <div className="flex items-center h-[60px] px-2 pb-safe">
          <BottomLink to="/" end icon={LayoutDashboard} label="Home" />
          <BottomLink to="/analytics" icon={BarChart2} label="Insights" />

          {/* Center FAB */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => setAddOpen(true)}
              aria-label="New entry"
              className="w-11 h-11 rounded-2xl bg-red-500 hover:bg-red-500/90 active:bg-red-600 text-white flex items-center justify-center shadow-xl shadow-red-500/40 transition-all active:scale-95 -mt-3"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 text-black text-[8px] font-black flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          <BottomLink to="/transactions" icon={Receipt} label="Logs" />
          <BottomLink to="/accounts" icon={Wallet} label="More" />
        </div>
      </nav>

      {/* ── DESKTOP FAB (bottom-right) ── */}
      <div className="hidden md:block">
        <button
          onClick={() => setAddOpen(true)}
          aria-label="New entry"
          className="fixed bottom-7 right-7 z-50 w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-500/90 active:bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/35 transition-all hover:scale-105 active:scale-95 group"
          style={{ boxShadow: "0 8px 32px -4px hsl(0 82% 48% / 0.40)" }}
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
          {/* Tooltip */}
          <span className="absolute right-full mr-3 whitespace-nowrap text-xs font-semibold text-white bg-black/90 px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
            New Entry
          </span>
        </button>
      </div>

      <QuickAddSheet open={addOpen} onOpenChange={setAddOpen} />
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

function BottomLink({ to, end, icon: Icon, label }: { to: string; end?: boolean; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors",
          isActive ? "text-red-400" : "text-white/30 hover:text-white/60"
        )
      }
    >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-bold tracking-widest uppercase">{label}</span>
    </NavLink>
  );
}
