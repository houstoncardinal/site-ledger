import { useMemo, useState } from "react";
import { useExpenses, useProjects } from "@/lib/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, X, ChevronLeft, ChevronRight, ExternalLink, Image as ImageIcon } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/types";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Receipts() {
  const { data: expenses = [] } = useExpenses();
  const { data: projects = [] } = useProjects();

  const [q, setQ] = useState("");
  const [project, setProject] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const withReceipts = useMemo(() => {
    return expenses
      .filter((e) => !!e.receipt_url)
      .filter((e) => {
        if (project !== "all" && e.project_id !== project) return false;
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        if (q) {
          const s = q.toLowerCase();
          if (!e.vendor.toLowerCase().includes(s) && !(e.description ?? "").toLowerCase().includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, project, from, to, q]);

  const openLightbox = (idx: number) => setLightbox(idx);
  const closeLightbox = () => setLightbox(null);
  const prev = () => setLightbox((i) => (i != null && i > 0 ? i - 1 : withReceipts.length - 1));
  const next = () => setLightbox((i) => (i != null ? (i + 1) % withReceipts.length : 0));

  const current = lightbox != null ? withReceipts[lightbox] : null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Receipts</h1>
          <p className="text-muted-foreground mt-1">
            {withReceipts.length} receipt{withReceipts.length !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 md:col-span-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vendor…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="h-10"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" placeholder="To" />
      </div>

      {withReceipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <ImageIcon className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No receipts match your filters.</p>
          <p className="text-sm text-muted-foreground mt-1">Attach receipts when logging expenses to see them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {withReceipts.map((exp, idx) => {
            const proj = projects.find((p) => p.id === exp.project_id);
            return (
              <button
                key={exp.id}
                onClick={() => openLightbox(idx)}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-muted border border-border hover:border-primary transition hover:shadow-lg"
              >
                <img
                  src={exp.receipt_url!}
                  alt={`Receipt — ${exp.vendor}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-200" />
                <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition duration-200">
                  <p className="text-white text-xs font-semibold truncate">{exp.vendor}</p>
                  <p className="text-white/70 text-xs">${Number(exp.amount).toLocaleString()}</p>
                </div>
                <div className="absolute top-2 right-2">
                  <Badge className="text-[10px] px-1.5 py-0 bg-black/50 text-white border-0">
                    {CATEGORY_LABELS[exp.category]}
                  </Badge>
                </div>
                {proj && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-black/50 text-white border-0 max-w-[80px] truncate">
                      {proj.name}
                    </Badge>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox != null && current && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Nav */}
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Image */}
          <div
            className="relative max-h-[85vh] max-w-[90vw] flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={current.receipt_url!}
              alt={`Receipt — ${current.vendor}`}
              className="max-h-[70vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
            />
            {/* Meta card */}
            <div className="w-full bg-zinc-900 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{current.vendor}</p>
                <p className="text-zinc-400 text-sm">
                  {format(new Date(current.date), "MMM d, yyyy")} · {CATEGORY_LABELS[current.category]}
                  {projects.find((p) => p.id === current.project_id) && (
                    <> · {projects.find((p) => p.id === current.project_id)?.name}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-white font-bold text-lg">${Number(current.amount).toLocaleString()}</span>
                <a
                  href={current.receipt_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
            <p className="text-zinc-500 text-xs">{lightbox + 1} / {withReceipts.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
