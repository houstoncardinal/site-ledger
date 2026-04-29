import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CATEGORY_LABELS, ExpenseCategory, PAYMENT_METHODS,
} from "@/lib/types";
import {
  useAccounts, useCreateExpense, useCreateIncome, useProjects, useVendors,
} from "@/lib/hooks";
import {
  HardHat, Package, Truck, Receipt as ReceiptIcon, MoreHorizontal,
  ArrowLeft, Check, Camera, DollarSign, Briefcase, Wallet,
  Mic, MicOff, RotateCcw, X, ChevronRight, Repeat2, Sparkles, Loader2,
} from "lucide-react";
import { receiptsApi } from "@/lib/api";
import { autoCategory } from "@/lib/autoCategorize";
import { analyzeReceipt, smartCategorize, isAIEnabled, type ReceiptData } from "@/lib/openai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "expense" | "income";
type Step = "quick" | "pick" | "camera" | "form";

interface LastEntry {
  mode: Mode;
  vendor: string;
  amount: string;
  category: ExpenseCategory;
  project_id: string;
  notes: string;
}

const CATS: { type: ExpenseCategory; icon: any; color: string }[] = [
  { type: "labor", icon: HardHat, color: "from-amber-500 to-orange-600" },
  { type: "materials", icon: Package, color: "from-blue-500 to-blue-700" },
  { type: "equipment", icon: Truck, color: "from-emerald-500 to-emerald-700" },
  { type: "subcontractor", icon: Briefcase, color: "from-purple-500 to-purple-700" },
  { type: "operating", icon: Wallet, color: "from-cyan-600 to-cyan-800" },
  { type: "other", icon: MoreHorizontal, color: "from-zinc-600 to-zinc-800" },
];

// ─── Persistent last-entry helpers ───────────────────────────────────────────

const LAST_KEY = "sl_last_entry";

function saveLastEntry(e: LastEntry) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(e)); } catch { /* ignore */ }
}

function loadLastEntry(): LastEntry | null {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? "null"); } catch { return null; }
}

// ─── Voice Input Hook ─────────────────────────────────────────────────────────

function useVoice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    recognitionRef.current = r;
    r.start();
  }, [supported, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, start, stop, supported };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuickAddSheet({
  open, onOpenChange, defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: string;
}) {
  const { data: projects = [] } = useProjects();
  const { data: accounts = [] } = useAccounts();
  const { data: vendors = [] } = useVendors();
  const createExpense = useCreateExpense();
  const createIncome = useCreateIncome();

  const activeProjects = useMemo(() => projects.filter((p) => p.status === "active"), [projects]);
  const today = new Date().toISOString().slice(0, 10);
  const smartDefaultProject = defaultProjectId ?? activeProjects[0]?.id ?? "none";

  // ── State ──
  const [mode, setMode] = useState<Mode>("expense");
  const [step, setStep] = useState<Step>("quick");
  const [category, setCategory] = useState<ExpenseCategory>("materials");
  const [uploading, setUploading] = useState(false);
  const [cameraPreview, setCameraPreview] = useState<string | null>(null);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiResult, setAiResult] = useState<ReceiptData | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Quick mode state
  const [quickAmount, setQuickAmount] = useState("");
  const [quickProject, setQuickProject] = useState(smartDefaultProject);
  const [quickCategory, setQuickCategory] = useState<ExpenseCategory>("materials");
  const [quickVendor, setQuickVendor] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [lastEntry, setLastEntry] = useState<LastEntry | null>(null);

  // Full form state
  const [form, setForm] = useState({
    project_id: smartDefaultProject,
    account_id: "none" as string,
    date: today,
    vendor: "",
    description: "",
    amount: "",
    payment_method: "Credit Card",
    payment_status: "paid" as "paid" | "unpaid",
    notes: "",
    hours: "", rate: "",
    quantity: "", unit_price: "",
    receipt_url: "" as string,
    invoice_number: "",
    client_name: "",
  });

  // Voice input for quick note and full-form description
  const quickNoteVoice = useVoice((t) => setQuickNote(t));
  const descVoice = useVoice((t) => setForm((f) => ({ ...f, description: t })));
  const notesVoice = useVoice((t) => setForm((f) => ({ ...f, notes: t })));

  // ── Reset on open ──
  useEffect(() => {
    if (open) {
      const project = defaultProjectId ?? activeProjects[0]?.id ?? "none";
      setStep("quick");
      setMode("expense");
      setQuickAmount("");
      setQuickProject(project);
      setQuickCategory("materials");
      setQuickVendor("");
      setQuickNote("");
      setLastEntry(loadLastEntry());
      setCameraPreview(null);
      setAiResult(null);
      stopCamera();
      setForm((f) => ({
        ...f,
        project_id: project,
        account_id: accounts[0]?.id ?? "none",
        date: today,
        vendor: "", description: "", amount: "",
        notes: "", hours: "", rate: "", quantity: "", unit_price: "",
        receipt_url: "", invoice_number: "", client_name: "",
        payment_status: "paid",
      }));
      // auto-focus amount
      setTimeout(() => amountRef.current?.focus(), 80);
    } else {
      stopCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Camera helpers ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
    } catch {
      setStep("form");
    }
  };
  const stopCamera = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    stopCamera();
    setCameraPreview(canvas.toDataURL("image/jpeg", 0.85));
  };
  const confirmCameraPhoto = async () => {
    if (!cameraPreview) return;

    // Run AI analysis + upload in parallel
    setAiScanning(true);
    setUploading(true);

    try {
      const [receiptData, uploadUrl] = await Promise.allSettled([
        isAIEnabled() ? analyzeReceipt(cameraPreview) : Promise.resolve(null),
        (async () => {
          const blob = await (await fetch(cameraPreview)).blob();
          const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
          return receiptsApi.upload(file);
        })(),
      ]);

      // Apply upload result
      if (uploadUrl.status === "fulfilled") {
        setForm((f) => ({ ...f, receipt_url: uploadUrl.value }));
      }

      // Apply AI results
      if (receiptData.status === "fulfilled" && receiptData.value) {
        const ai = receiptData.value;
        setAiResult(ai);
        setQuickVendor(ai.vendor ?? "");
        if (ai.amount) setQuickAmount(String(ai.amount));
        if (ai.category) setQuickCategory(ai.category);
        if (ai.date) setForm((f) => ({ ...f, date: ai.date! }));
        if (ai.payment_method) setForm((f) => ({ ...f, payment_method: ai.payment_method! }));
        if (ai.description) setQuickNote(ai.description);
        toast.success("Receipt scanned — fields pre-filled");
      } else {
        if (uploadUrl.status === "fulfilled") toast.success("Receipt attached");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAiScanning(false);
      setUploading(false);
    }

    setCameraPreview(null);
    setStep("quick");
  };
  const retakePhoto = () => { setCameraPreview(null); startCamera(); };
  useEffect(() => { if (step === "camera") startCamera(); return () => stopCamera(); }, [step]); // eslint-disable-line

  // ── Auto-categorize while typing vendor (keyword first, AI fallback) ──
  const handleVendorChange = (name: string) => {
    setQuickVendor(name);
    if (name.length >= 2) {
      const kwCat = autoCategory(name, vendors);
      if (kwCat) {
        setQuickCategory(kwCat);
      } else if (isAIEnabled() && name.length >= 4) {
        // Debounce AI call — only fire after user stops typing 600ms
        const timeout = setTimeout(async () => {
          const aiCat = await smartCategorize(name).catch(() => null);
          if (aiCat) setQuickCategory(aiCat);
        }, 600);
        return () => clearTimeout(timeout);
      }
    }
  };

  // ── Vendor suggestions for quick mode ──
  const vendorSuggestions = useMemo(() => {
    if (!quickVendor || quickVendor.length < 1) return [];
    const q = quickVendor.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(q) && v.name.toLowerCase() !== q).slice(0, 4);
  }, [quickVendor, vendors]);

  const pickVendorSuggestion = (name: string, cat?: string | null) => {
    setQuickVendor(name);
    if (cat) setQuickCategory(cat as ExpenseCategory);
    else {
      const guessed = autoCategory(name, vendors);
      if (guessed) setQuickCategory(guessed);
    }
  };

  // ── Repeat last entry ──
  const applyLastEntry = () => {
    if (!lastEntry) return;
    setMode(lastEntry.mode);
    setQuickAmount(lastEntry.amount);
    setQuickVendor(lastEntry.vendor);
    setQuickCategory(lastEntry.category);
    setQuickProject(lastEntry.project_id);
    setQuickNote(lastEntry.notes);
  };

  // ── Quick submit ──
  const submitQuick = async () => {
    const amount = parseFloat(quickAmount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");

    const entry: LastEntry = {
      mode,
      vendor: quickVendor.trim(),
      amount: quickAmount,
      category: quickCategory,
      project_id: quickProject,
      notes: quickNote.trim(),
    };

    if (mode === "expense") {
      if (!quickVendor.trim()) return toast.error("Vendor is required");
      await createExpense.mutateAsync({
        project_id: quickProject !== "none" ? quickProject : null,
        account_id: accounts[0]?.id ?? null,
        date: today,
        category: quickCategory,
        vendor: quickVendor.trim(),
        description: quickNote.trim() || null,
        amount,
        payment_method: "Credit Card",
        payment_status: "paid",
        receipt_url: null,
        notes: null,
      });
    } else {
      await createIncome.mutateAsync({
        project_id: quickProject !== "none" ? quickProject : null,
        account_id: accounts[0]?.id ?? null,
        date: today,
        client_name: quickVendor.trim() || null,
        description: quickNote.trim() || null,
        amount,
        payment_status: "paid",
      });
    }

    saveLastEntry(entry);
    onOpenChange(false);
  };

  // ── Full form submit ──
  const computedAmount = useMemo(() => {
    if (mode === "expense" && category === "labor" && form.hours && form.rate)
      return (parseFloat(form.hours) * parseFloat(form.rate)).toFixed(2);
    if (mode === "expense" && category === "materials" && form.quantity && form.unit_price)
      return (parseFloat(form.quantity) * parseFloat(form.unit_price)).toFixed(2);
    return form.amount;
  }, [category, form, mode]);

  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await receiptsApi.upload(file);
      setForm((f) => ({ ...f, receipt_url: url }));
      toast.success("Receipt attached");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submitFull = async () => {
    const amount = parseFloat(computedAmount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");

    if (mode === "expense") {
      if (!form.vendor.trim()) return toast.error("Vendor is required");
      await createExpense.mutateAsync({
        project_id: form.project_id !== "none" ? form.project_id : null,
        account_id: form.account_id !== "none" ? form.account_id : null,
        date: form.date,
        category,
        vendor: form.vendor.trim(),
        description: form.description.trim() || null,
        amount,
        payment_method: form.payment_method,
        payment_status: form.payment_status,
        receipt_url: form.receipt_url || null,
        notes: form.notes.trim() || null,
        hours: form.hours ? parseFloat(form.hours) : null,
        rate: form.rate ? parseFloat(form.rate) : null,
        quantity: form.quantity ? parseFloat(form.quantity) : null,
        unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      });
    } else {
      await createIncome.mutateAsync({
        project_id: form.project_id !== "none" ? form.project_id : null,
        account_id: form.account_id !== "none" ? form.account_id : null,
        date: form.date,
        client_name: form.client_name.trim() || null,
        description: form.description.trim() || null,
        invoice_number: form.invoice_number.trim() || null,
        amount,
        payment_status: form.payment_status,
        notes: form.notes.trim() || null,
      });
    }

    saveLastEntry({ mode, vendor: form.vendor || form.client_name, amount: computedAmount, category, project_id: form.project_id, notes: form.notes });
    onOpenChange(false);
  };

  // ── Title logic ──
  const title =
    step === "quick" ? "Quick Add"
      : step === "camera" ? "Capture Receipt"
      : step === "pick" ? "Advanced Entry"
      : mode === "income" ? "Record Income"
      : `Log ${CATEGORY_LABELS[category]}`;

  const pending = createExpense.isPending || createIncome.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[96vh] sm:max-w-xl sm:mx-auto rounded-t-2xl p-0 flex flex-col">
        <div className="h-1.5 industrial-stripe rounded-t-2xl" />

        {/* Header */}
        <SheetHeader className="p-5 pb-3 text-left">
          <SheetTitle className="font-display text-2xl flex items-center gap-3">
            {(step === "form" || step === "pick" || step === "camera") && (
              <button
                onClick={() => {
                  if (step === "camera") { stopCamera(); setCameraPreview(null); }
                  setStep(step === "form" ? "pick" : "quick");
                }}
                className="w-8 h-8 rounded-md bg-muted flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {title}
            {step === "quick" && (
              <button
                onClick={() => setStep("pick")}
                className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-0.5 hover:text-foreground transition"
              >
                Advanced <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {step === "quick" ? "Fast entry — 5 seconds" : "Full entry form"}
          </SheetDescription>
        </SheetHeader>

        {/* ── QUICK MODE ── */}
        {step === "quick" && (
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
            {/* Expense / Income toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode("expense")}
                className={cn("flex-1 h-10 rounded-lg text-sm font-semibold transition", mode === "expense" ? "bg-gradient-primary text-white shadow-red" : "bg-muted text-muted-foreground hover:text-foreground")}
              >
                Expense
              </button>
              <button
                onClick={() => setMode("income")}
                className={cn("flex-1 h-10 rounded-lg text-sm font-semibold transition", mode === "income" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground")}
              >
                Income
              </button>
            </div>

            {/* Amount — large and prominent */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground select-none">$</span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                className="w-full pl-10 pr-4 h-16 text-3xl font-display font-bold bg-muted rounded-xl border-2 border-transparent focus:border-primary outline-none transition"
              />
            </div>

            {/* Project */}
            {activeProjects.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Project</label>
                <div className="flex flex-wrap gap-2">
                  {activeProjects.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setQuickProject(p.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition",
                        quickProject === p.id
                          ? "bg-surface-dark text-white"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                  {activeProjects.length > 4 && (
                    <Select value={quickProject} onValueChange={setQuickProject}>
                      <SelectTrigger className="h-9 text-sm w-auto"><SelectValue placeholder="More…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {activeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* Category chips (expense only) */}
            {mode === "expense" && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATS.map((c) => (
                    <button
                      key={c.type}
                      onClick={() => setQuickCategory(c.type)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition",
                        quickCategory === c.type
                          ? `bg-gradient-to-r ${c.color} text-white shadow-sm`
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <c.icon className="w-3.5 h-3.5" />
                      {CATEGORY_LABELS[c.type]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Vendor / Client with voice */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-2">
                {mode === "income" ? "Client" : "Vendor"} <span className="normal-case font-normal">(optional)</span>
                {aiResult?.vendor && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                    <Sparkles className="w-2.5 h-2.5" /> AI filled
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  placeholder={mode === "income" ? "Client name" : "e.g. Home Depot"}
                  value={quickVendor}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  className="h-11 pr-10"
                />
                {quickNoteVoice.supported && (
                  <button
                    type="button"
                    onMouseDown={() => quickNoteVoice.listening ? quickNoteVoice.stop() : quickNoteVoice.start()}
                    className={cn("absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center transition",
                      quickNoteVoice.listening ? "bg-primary text-white animate-pulse" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {quickNoteVoice.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {vendorSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {vendorSuggestions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => pickVendorSuggestion(v.name, v.default_category)}
                      className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition"
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Note <span className="normal-case font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Input
                  placeholder="Quick note…"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  className="h-11 pr-10"
                />
                {quickNoteVoice.supported && (
                  <button
                    type="button"
                    onMouseDown={() => quickNoteVoice.listening ? quickNoteVoice.stop() : quickNoteVoice.start()}
                    className={cn("absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center transition",
                      quickNoteVoice.listening ? "bg-primary text-white animate-pulse" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {quickNoteVoice.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Receipt shortcut */}
            <button
              onClick={() => { setStep("camera"); }}
              className="w-full flex items-center gap-2 h-10 rounded-xl border border-dashed border-muted-foreground/30 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
            >
              <Camera className="w-3.5 h-3.5 ml-3" /> Add receipt photo
            </button>

            {/* Repeat last entry */}
            {lastEntry && (
              <button
                onClick={applyLastEntry}
                className="w-full flex items-center gap-2 px-4 h-11 rounded-xl bg-muted/60 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition"
              >
                <Repeat2 className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left truncate">
                  Repeat: <span className="font-medium">{lastEntry.vendor || "last entry"}</span>
                  {lastEntry.amount && <> · <span className="font-medium">${lastEntry.amount}</span></>}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ── PICK / ADVANCED CATEGORY SCREEN ── */}
        {step === "pick" && (
          <div className="px-5 pb-5 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => { setMode("income"); setStep("form"); }}
                className="aspect-[2.2/1] rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-4 flex flex-col justify-between text-left shadow-md active:scale-95 transition"
              >
                <DollarSign className="w-7 h-7" />
                <div><div className="font-display font-bold text-lg">Income</div><div className="text-xs text-white/80">Client payment</div></div>
              </button>
              <button
                onClick={() => { setMode("expense"); setCategory("other"); setStep("form"); }}
                className="aspect-[2.2/1] rounded-xl bg-gradient-to-br from-primary to-primary-glow text-white p-4 flex flex-col justify-between text-left shadow-red active:scale-95 transition"
              >
                <ReceiptIcon className="w-7 h-7" />
                <div><div className="font-display font-bold text-lg">Expense</div><div className="text-xs text-white/80">Generic cost</div></div>
              </button>
            </div>

            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 mt-4">By Category</div>
            <div className="grid grid-cols-3 gap-2.5">
              {CATS.map((t) => (
                <button
                  key={t.type}
                  onClick={() => { setMode("expense"); setCategory(t.type); setStep("form"); }}
                  className={cn("aspect-square rounded-xl bg-gradient-to-br text-white p-3 flex flex-col justify-between text-left shadow-md active:scale-95 transition", t.color)}
                >
                  <t.icon className="w-6 h-6" />
                  <div className="font-display font-bold text-sm leading-tight">{CATEGORY_LABELS[t.type]}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => { setMode("expense"); setCategory("other"); setStep("camera"); }}
              className="mt-4 w-full flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition text-sm font-medium"
            >
              <Camera className="w-4 h-4" /> Start with a Receipt
            </button>
          </div>
        )}

        {/* ── CAMERA STEP ── */}
        {step === "camera" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {cameraPreview ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 relative bg-black">
                  <img src={cameraPreview} alt="Receipt preview" className="w-full h-full object-contain" />
                  {aiScanning && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                        <Sparkles className="w-7 h-7 text-white animate-pulse" />
                      </div>
                      <p className="text-white font-semibold text-sm">AI scanning receipt…</p>
                      <p className="text-white/60 text-xs">Extracting amount, vendor & category</p>
                    </div>
                  )}
                </div>
                {isAIEnabled() && !aiScanning && (
                  <div className="px-5 pt-3 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">AI will auto-fill amount, vendor, date & category from this receipt</p>
                  </div>
                )}
                <div className="p-5 flex gap-3 border-t border-border bg-card">
                  <Button variant="outline" onClick={retakePhoto} className="flex-1 h-12" disabled={uploading || aiScanning}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Retake
                  </Button>
                  <Button onClick={confirmCameraPhoto} className="flex-1 h-12 bg-gradient-primary" disabled={uploading || aiScanning}>
                    {aiScanning ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…</>
                    ) : uploading ? (
                      "Uploading…"
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />{isAIEnabled() ? "Scan & Fill" : "Use Photo"}</>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 relative bg-black overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute inset-6 pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br" />
                  </div>
                </div>
                <div className="p-5 flex items-center justify-between border-t border-border bg-card">
                  <label className="w-12 h-12 rounded-full bg-muted flex items-center justify-center cursor-pointer">
                    <ReceiptIcon className="w-5 h-5 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      stopCamera();
                      const reader = new FileReader();
                      reader.onload = (ev) => setCameraPreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                  <button
                    onClick={capturePhoto}
                    className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition active:scale-90 flex items-center justify-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-white" />
                  </button>
                  <button
                    onClick={() => { stopCamera(); setCameraPreview(null); setStep("form"); }}
                    className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FULL FORM ── */}
        {step === "form" && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <Field label="Project">
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {activeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-12" />
              </Field>
              <Field label="Account">
                <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {mode === "expense" ? (
              <>
                <Field label="Vendor" required>
                  <Input
                    placeholder="e.g. Home Depot"
                    value={form.vendor}
                    onChange={(e) => {
                      setForm({ ...form, vendor: e.target.value });
                      if (e.target.value.length >= 2) {
                        const cat = autoCategory(e.target.value, vendors);
                        if (cat) setCategory(cat);
                      }
                    }}
                    className="h-12"
                  />
                </Field>

                <Field label="Category" required>
                  <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
                        <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {category === "labor" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Hours" required>
                      <Input type="number" inputMode="decimal" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} className="h-12" />
                    </Field>
                    <Field label="Rate ($/hr)" required>
                      <Input type="number" inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className="h-12" />
                    </Field>
                  </div>
                )}
                {category === "materials" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantity" required>
                      <Input type="number" inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="h-12" />
                    </Field>
                    <Field label="Unit Price" required>
                      <Input type="number" inputMode="decimal" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="h-12" />
                    </Field>
                  </div>
                )}
                {category !== "labor" && category !== "materials" && (
                  <Field label="Amount ($)" required>
                    <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-12 text-lg font-semibold" />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Payment">
                    <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as any })}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Client">
                  <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="h-12" placeholder="Client name" />
                </Field>
                <Field label="Amount ($)" required>
                  <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="h-12 text-lg font-semibold" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Invoice #">
                    <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} className="h-12" />
                  </Field>
                  <Field label="Status">
                    <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as any })}>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </>
            )}

            {/* Description with voice */}
            <Field label="Description">
              <div className="relative">
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="h-12 pr-10"
                  placeholder="Optional"
                />
                {descVoice.supported && (
                  <button
                    type="button"
                    onMouseDown={() => descVoice.listening ? descVoice.stop() : descVoice.start()}
                    className={cn("absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center transition",
                      descVoice.listening ? "bg-primary text-white animate-pulse" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {descVoice.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </Field>

            {mode === "expense" && (
              <Field label="Receipt">
                <label className="flex items-center justify-center gap-2 h-12 border border-dashed rounded-md cursor-pointer hover:border-primary hover:text-primary transition text-sm">
                  <Camera className="w-4 h-4" />
                  {uploading ? "Uploading…" : form.receipt_url ? "✓ Receipt attached" : "Tap to capture or upload"}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceipt} />
                </label>
              </Field>
            )}

            {/* Notes with voice */}
            <Field label="Notes">
              <div className="relative">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Optional"
                  className="pr-10"
                />
                {notesVoice.supported && (
                  <button
                    type="button"
                    onMouseDown={() => notesVoice.listening ? notesVoice.stop() : notesVoice.start()}
                    className={cn("absolute right-2 top-2 w-7 h-7 rounded-md flex items-center justify-center transition",
                      notesVoice.listening ? "bg-primary text-white animate-pulse" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {notesVoice.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </Field>

            <div className={cn("rounded-xl p-4 flex items-center justify-between text-white", mode === "income" ? "bg-emerald-700" : "bg-surface-dark")}>
              <span className="text-white/70 text-sm uppercase tracking-wider">Total</span>
              <span className="font-display font-bold text-2xl">
                {mode === "income" ? "+" : "-"}${computedAmount ? parseFloat(computedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "0.00"}
              </span>
            </div>
          </div>
        )}

        {/* ── ACTION BUTTONS ── */}
        {step === "quick" && (
          <div className="p-5 border-t border-border bg-card space-y-2">
            <Button
              onClick={submitQuick}
              disabled={pending}
              className={cn(
                "w-full h-14 text-base font-semibold",
                mode === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gradient-primary shadow-red hover:opacity-95"
              )}
            >
              <Check className="w-5 h-5 mr-2" />
              Log It{quickAmount ? ` · $${parseFloat(quickAmount || "0").toLocaleString()}` : ""}
            </Button>
          </div>
        )}

        {step === "form" && (
          <div className="p-5 border-t border-border bg-card">
            <Button
              onClick={submitFull}
              disabled={pending}
              className={cn(
                "w-full h-14 text-base font-semibold shadow-red",
                mode === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gradient-primary hover:opacity-95"
              )}
            >
              <Check className="w-5 h-5 mr-2" /> Save Entry
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}
