import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Plus, Receipt, Wallet,
  Image, WifiOff, BarChart2, HelpCircle, Zap, Users, FileSignature,
} from "lucide-react";
import { useEffect, useState } from "react";
import QuickAddSheet from "./QuickAddSheet";
import HelpPanel from "./HelpPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useOfflineSync, useIsOnline } from "@/hooks/useOfflineSync";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { isAIEnabled } from "@/lib/openai";
import AIAgentSheet from "./AIAgentSheet";

const NAV_OVERVIEW = [
  { to: "/", label: "Quick Start", icon: Zap, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Intelligence", icon: BarChart2, badge: "AI" },
];

const NAV_MANAGE = [
  { to: "/checks", label: "Checks", icon: FileSignature, badge: "PRIORITY" },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/vendors", label: "Vendors", icon: Users },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/receipts", label: "Receipts", icon: Image },
  { to: "/accounts", label: "Accounts", icon: Wallet },
];

const PAGE_LABELS: Record<string, string> = {
  "/": "Quick Start",
  "/dashboard": "Dashboard",
  "/analytics": "Intelligence",
  "/projects": "Projects",
  "/vendors": "Vendors",
  "/transactions": "Transactions",
  "/checks": "Check Register",
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
          "flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150",
          isActive
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("w-[15px] h-[15px] shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} />
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
  const [addInitialStep, setAddInitialStep] = useState<"quick" | "camera" | undefined>(undefined);
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const { pendingCount } = useOfflineSync();
  useRealtimeSync();
  const online = useIsOnline();
  const aiEnabled = isAIEnabled();

  const pageLabel = PAGE_LABELS[loc.pathname] ?? loc.pathname.split("/")[1] ?? "HOU INC";

  // Allow URL-driven “open Quick Add” flows, e.g. from Quick Start.
  // /dashboard?add=quick|camera
  // We auto-open the sheet, then remove the query param (replace) to avoid re-triggering.
  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const add = params.get("add");
    if (add === "quick" || add === "camera") {
      setAddInitialStep(add);
      setAddOpen(true);
      params.delete("add");
      const nextSearch = params.toString();
      nav({ pathname: loc.pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true });
    }
  }, [loc.pathname, loc.search, nav]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,hsl(0_0%_100%),hsl(210_40%_98%))] flex flex-col md:flex-row">

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex md:w-[240px] flex-col shrink-0 border-r border-border/70 bg-white/70 backdrop-blur-xl">

        {/* Wordmark */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="font-display font-black text-white text-[11px] leading-none tracking-tight">HOU</span>
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-display font-bold text-[14px] text-foreground tracking-tight">HOU INC</div>
              <div className="text-[10px] text-muted-foreground font-medium tracking-wide">Bookkeeper AI</div>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="px-3 pb-4">
          <button
            onClick={() => { setAddInitialStep(undefined); setAddOpen(true); }}
            className="w-full h-10 rounded-2xl bg-gradient-primary hover:opacity-95 active:opacity-90 text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all shadow-sm"
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
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em]">Overview</span>
            </div>
            <div className="space-y-0.5">
              {NAV_OVERVIEW.map((n) => <NavItem key={n.to} {...n} />)}
            </div>
          </div>

          {/* Manage group */}
          <div>
            <div className="px-3 mb-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em]">Manage</span>
            </div>
            <div className="space-y-0.5">
              {NAV_MANAGE.map((n) => <NavItem key={n.to} {...n} />)}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-border/70 space-y-1.5">
          {/* Offline / sync badge */}
          {(!online || pendingCount > 0) && (
            <div className={cn(
              "flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-medium",
              !online ? "bg-yellow-500/10 text-yellow-700" : "bg-emerald-500/10 text-emerald-700"
            )}>
              <WifiOff className="w-3 h-3 shrink-0" />
              {!online ? "Offline — entries queued" : `${pendingCount} pending sync`}
            </div>
          )}

          {/* Bottom actions row */}
          <div className="flex items-center justify-between px-1">
            {aiEnabled ? (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AI active
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground/70">AI disabled</div>
            )}
            <button
              onClick={() => setHelpOpen(true)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Help
            </button>
          </div>
        </div>
      </aside>

      {/* ── MOBILE HEADER ── */}
      <header className="md:hidden sticky top-0 z-30 border-b border-border/60 bg-white/85 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 h-14 pt-safe">
          {/* Menu */}
          <button
            onClick={() => setMenuOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Open menu"
          >
            <span className="text-lg leading-none">≡</span>
          </button>

          {/* Logo mark */}
          <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-sm">
            <span className="font-display font-black text-white text-[9px] tracking-tight">HOU</span>
          </div>

          {/* Page title */}
          <span className="font-display font-semibold text-foreground text-[14px] flex-1 truncate">{pageLabel}</span>

          {/* Sync badge */}
          {(!online || pendingCount > 0) && (
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
              !online ? "bg-yellow-500/10 text-yellow-700" : "bg-emerald-500/10 text-emerald-700"
            )}>
              {!online ? "Offline" : `${pendingCount}↑`}
            </span>
          )}

          {/* Help */}
          <button
            onClick={() => setHelpOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Add */}
          <button
            onClick={() => { setAddInitialStep(undefined); setAddOpen(true); }}
            className="flex items-center gap-1.5 h-9 px-4 bg-gradient-primary hover:opacity-95 active:opacity-90 rounded-2xl text-white font-bold text-[12px] transition-all shadow-sm shrink-0"
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
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-white/90 backdrop-blur-xl"
      >
        <div className="flex items-center h-[60px] px-2 pb-safe">
          <BottomLink to="/" end icon={Zap} label="Start" />
          <BottomLink to="/projects" icon={FolderKanban} label="Projects" />

          {/* Center FAB */}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => { setAddInitialStep(undefined); setAddOpen(true); }}
              aria-label="New entry"
              className="w-12 h-12 rounded-2xl bg-gradient-primary hover:opacity-95 active:opacity-90 text-white flex items-center justify-center shadow-lg transition-all active:scale-95 -mt-4"
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
          <BottomLink to="/dashboard" icon={LayoutDashboard} label="Dash" />
        </div>
      </nav>

      {/* Agent sheet */}
      <AIAgentSheet open={agentOpen} onOpenChange={setAgentOpen} />

      {/* ── DESKTOP FAB (bottom-right) ── */}
      <div className="hidden md:block">
        <button
          onClick={() => { setAddInitialStep(undefined); setAddOpen(true); }}
          aria-label="New entry"
          className="fixed bottom-7 right-7 z-50 w-14 h-14 rounded-2xl bg-gradient-primary hover:opacity-95 active:opacity-90 text-white flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 group"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
          {/* Tooltip */}
          <span className="absolute right-full mr-3 whitespace-nowrap text-xs font-semibold text-white bg-surface-dark px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
            New Entry
          </span>
        </button>
      </div>

      <QuickAddSheet open={addOpen} onOpenChange={setAddOpen} initialStep={addInitialStep} />
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />

      {/* ── MOBILE MENU SHEET ── */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="p-0 w-[86vw] max-w-sm">
          <div className="p-4 border-b border-border/70 bg-white/70 backdrop-blur-xl">
            <SheetHeader className="space-y-0 text-left">
              <SheetTitle className="font-display text-lg">Menu</SheetTitle>
            </SheetHeader>
            <div className="text-xs text-muted-foreground mt-1">Navigate the platform</div>
          </div>

          <div className="p-3 space-y-4">
            <div>
              <div className="px-2 mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">Overview</span>
              </div>
              <div className="space-y-1">
                {NAV_OVERVIEW.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={(n as any).end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium",
                      isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <n.icon className="w-4 h-4" />
                    <span className="flex-1">{n.label}</span>
                    {(n as any).badge && (
                      <span className="text-[9px] font-bold bg-primary/80 text-white px-1.5 py-0.5 rounded-full leading-none tracking-wide">{(n as any).badge}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            <div>
              <div className="px-2 mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.12em]">Manage</span>
              </div>
              <div className="space-y-1">
                {NAV_MANAGE.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium",
                      isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <n.icon className="w-4 h-4" />
                    <span className="flex-1">{n.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
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
          "flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-all",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className={cn(
            "w-10 h-8 rounded-2xl flex items-center justify-center",
            "transition-colors",
            isActive ? "bg-primary/10" : "bg-transparent"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-bold tracking-widest uppercase">{label}</span>
        </>
      )}
    </NavLink>
  );
}
