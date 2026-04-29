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
  useAccounts, useCreateExpense, useCreateIncome, useCreateProject, useProjects, useVendors,
} from "@/lib/hooks";
import {
  HardHat, Package, Truck, Receipt as ReceiptIcon, MoreHorizontal,
  ArrowLeft, Check, Camera, DollarSign, Briefcase, Wallet,
  Mic, MicOff, RotateCcw, X, ChevronRight, Repeat2, Sparkles, Loader2,
  Plus,
} from "lucide-react";
import { receiptsApi } from "@/lib/api";
import { autoCategory } from "@/lib/autoCategorize";
import { analyzeReceipt, smartCategorize, isAIEnabled, suggestEntryFromNote, voiceLogAssistant, type ReceiptData } from "@/lib/openai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

const CAT_META: Record<ExpenseCategory, { icon: any; label: string }> = {
  labor: { icon: HardHat, label: CATEGORY_LABELS.labor },
  materials: { icon: Package, label: CATEGORY_LABELS.materials },
  equipment: { icon: Truck, label: CATEGORY_LABELS.equipment },
  subcontractor: { icon: Briefcase, label: CATEGORY_LABELS.subcontractor },
  cogs: { icon: ReceiptIcon, label: CATEGORY_LABELS.cogs },
  operating: { icon: Wallet, label: CATEGORY_LABELS.operating },
  other: { icon: MoreHorizontal, label: CATEGORY_LABELS.other },
};

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

// Ensure only one voice recognizer is active at a time across fields.
// Without this, tapping mic on Vendor and then Note can cause both fields
// to update because they each spin up independent recognizers.
const VOICE_BUS_KEY = "sl_voice_bus_v1";

function stopOtherVoiceSessions() {
  try {
    window.dispatchEvent(new CustomEvent(VOICE_BUS_KEY));
  } catch {
    // ignore
  }
}

function VendorPicker({
  vendors,
  value,
  onPick,
}: {
  vendors: { id: string; name: string; default_category: string | null }[];
  value: string;
  onPick: (vendorName: string, defaultCategory?: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const top = useMemo(() => {
    return [...vendors]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 80);
  }, [vendors]);

  if (vendors.length === 0) {
    return (
      <button
        type="button"
        className={cn(
          "h-9 px-3 rounded-xl border border-border/60 bg-background/50",
          "text-xs font-semibold text-muted-foreground/70",
        )}
        disabled
        aria-label="Pick vendor"
      >
        Pick
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-9 px-3 rounded-xl border border-border/60 bg-background hover:bg-muted",
            "text-xs font-semibold text-muted-foreground hover:text-foreground transition",
          )}
          aria-label="Pick vendor"
        >
          Pick
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px] max-w-[92vw]" align="end">
        <Command>
          <CommandInput placeholder="Search vendors…" />
          <CommandList>
            <CommandEmpty>No vendors found.</CommandEmpty>
            <CommandGroup heading="Vendors">
              {top.map((v) => (
                <CommandItem
                  key={v.id}
                  value={v.name}
                  onSelect={() => {
                    onPick(v.name, v.default_category);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{v.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuickAddSheet({
  open, onOpenChange, defaultProjectId, initialStep,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: string;
  initialStep?: "quick" | "camera";
}) {
  const { data: projects = [] } = useProjects();
  const { data: accounts = [] } = useAccounts();
  const { data: vendors = [] } = useVendors();
  const createExpense = useCreateExpense();
  const createIncome = useCreateIncome();
  const createProject = useCreateProject();

  const activeProjects = useMemo(() => projects.filter((p) => p.status === "active"), [projects]);
  const today = new Date().toISOString().slice(0, 10);
  const smartDefaultProject = defaultProjectId ?? activeProjects[0]?.id ?? "none";

  // ── State ──
  const [mode, setMode] = useState<Mode>("expense");
  const [step, setStep] = useState<Step>("quick");
  const [category, setCategory] = useState<ExpenseCategory>("materials");
  const [uploading, setUploading] = useState(false);
  const [cameraReturnStep, setCameraReturnStep] = useState<Step>("quick");
  const [cameraPreview, setCameraPreview] = useState<string | null>(null);
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
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
  const [quickReceiptUrl, setQuickReceiptUrl] = useState<string | null>(null);
  const [quickDate, setQuickDate] = useState(today);
  const [quickHours, setQuickHours] = useState("");
  const [quickRate, setQuickRate] = useState("");
  const [quickQty, setQuickQty] = useState("");
  const [quickUnitPrice, setQuickUnitPrice] = useState("");
  const [lastEntry, setLastEntry] = useState<LastEntry | null>(null);

  // AI voice assistant (guided)
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);
  const [assistantLastHeard, setAssistantLastHeard] = useState<string | null>(null);
  const [assistantBusy, setAssistantBusy] = useState(false);

  // Inline “create project”
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");

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
  const quickVendorVoice = useVoice((t) => handleVendorChange(t));
  const quickNoteVoice = useVoice((t) => setQuickNote(t));
  const assistantVoice = useVoice((t) => {
    setAssistantLastHeard(t);
    void runAssistant(t);
  });
  const descVoice = useVoice((t) => setForm((f) => ({ ...f, description: t })));
  const notesVoice = useVoice((t) => setForm((f) => ({ ...f, notes: t })));

  // Subscribe each voice instance to the global stop event.
  // This guarantees only one mic button controls listening at a time.
  useEffect(() => {
    const handler = () => {
      quickVendorVoice.stop();
      quickNoteVoice.stop();
      assistantVoice.stop();
      descVoice.stop();
      notesVoice.stop();
    };
    window.addEventListener(VOICE_BUS_KEY, handler as any);
    return () => window.removeEventListener(VOICE_BUS_KEY, handler as any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAssistant = async (utterance: string) => {
    const text = utterance.trim();
    if (!text) return;
    setAssistantBusy(true);
    try {
      if (isAIEnabled()) {
        const projectNames = projects.map((p) => p.name);
        const res = await voiceLogAssistant(text, projectNames);

        if (res.mode === "income") setMode("income");
        if (res.mode === "expense") setMode("expense");

        if (res.amount != null) setQuickAmount(String(res.amount));
        if (res.vendor) handleVendorChange(res.vendor);
        if (res.client_name) handleVendorChange(res.client_name);
        if (res.category) setQuickCategory(res.category);
        if (res.notes) setQuickNote(res.notes);

        if (res.project) {
          const match = projects.find((p) => p.name.toLowerCase() === res.project!.toLowerCase());
          if (match) setQuickProject(match.id);
        }

        if (res.needs) {
          setAssistantPrompt(res.needs);
          toast.message(res.needs);
        } else {
          setAssistantPrompt(null);
          toast.success("AI filled the entry — review and tap Log It");
        }
      } else {
        // No API key: still do a best-effort parse with the local note parser.
        const s = await suggestEntryFromNote(text);
        if (s?.amount != null) setQuickAmount(String(s.amount));
        if (s?.vendor) handleVendorChange(s.vendor);
        if (s?.category) setQuickCategory(s.category);
        if (s?.description) setQuickNote(s.description);
        toast.success("Filled what I could — add the missing fields and log it");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "AI assistant failed");
    } finally {
      setAssistantBusy(false);
    }
  };

  // ── Reset on open ──
  useEffect(() => {
    if (open) {
      const project = defaultProjectId ?? activeProjects[0]?.id ?? "none";
      setStep(initialStep === "camera" ? "camera" : "quick");
      setMode("expense");
      setQuickAmount("");
      setQuickProject(project);
      setQuickCategory("materials");
      setQuickVendor("");
      setQuickNote("");
      setQuickReceiptUrl(null);
      setQuickDate(today);
      setQuickHours("");
      setQuickRate("");
      setQuickQty("");
      setQuickUnitPrice("");
      setLastEntry(loadLastEntry());
      setCameraPreview(null);
      setCameraFile(null);
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
  const requestCameraStream = async () => {
    try {
      // Try high quality first, then fall back.
      const constraintsHQ: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          // Request high resolution for better OCR/AI extraction.
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          // Best-effort camera quality knobs (not supported on all devices/browsers)
          focusMode: "continuous" as any,
          exposureMode: "continuous" as any,
          whiteBalanceMode: "continuous" as any,
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraintsHQ);
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }

      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      // If camera isn't available (permissions/device), drop into full form.
      setStep("form");
    }
  };

  const startCamera = async () => {
    // Attach existing stream if we have one; otherwise do nothing (user can tap Enable Camera).
    if (streamRef.current && videoRef.current) {
      try {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
        setCameraActive(true);
      } catch {
        // ignore
      }
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };
  const capturePhoto = () => {
    if (!videoRef.current) return;
    // iOS Safari sometimes reports 0x0 until metadata is loaded.
    // In that case, wait for the video to be ready and retry.
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      const v = videoRef.current;
      const retry = () => {
        v.removeEventListener("loadedmetadata", retry);
        v.removeEventListener("canplay", retry);
        // Guard against unmounted/step change
        if (videoRef.current) capturePhoto();
      };
      v.addEventListener("loadedmetadata", retry, { once: true });
      v.addEventListener("canplay", retry, { once: true });
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    stopCamera();
    setCameraFile(null);
    // Slightly higher quality for better OCR/AI extraction.
    setCameraPreview(canvas.toDataURL("image/jpeg", 0.98));
  };
  const confirmCameraPhoto = async () => {
    if (!cameraPreview && !cameraFile) return;

    // Run AI analysis + upload in parallel
    setAiScanning(true);
    setUploading(true);

    try {
      // If user uploaded a file:
      // - PDFs: upload only, no AI vision
      // - Images: upload + (optional) AI vision using the preview
      const isPdf = cameraFile?.type === "application/pdf";
      const [receiptData, uploadUrl] = await Promise.allSettled([
        isAIEnabled() && !isPdf && cameraPreview ? analyzeReceipt(cameraPreview) : Promise.resolve(null),
        (async () => {
          if (cameraFile) return receiptsApi.upload(cameraFile);
          // captured photo path
          const blob = await (await fetch(cameraPreview!)).blob();
          const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
          return receiptsApi.upload(file);
        })(),
      ]);

      // Apply upload result
      if (uploadUrl.status === "fulfilled") {
        setForm((f) => ({ ...f, receipt_url: uploadUrl.value }));
        setQuickReceiptUrl(uploadUrl.value);
      }

      // Apply AI results
      if (receiptData.status === "fulfilled" && receiptData.value) {
        const ai = receiptData.value;
        applyReceiptAI(ai);
        toast.success("Receipt scanned — review & save");

        // Bring user to the full form so all fields are visible + editable.
        setStep("form");
      } else {
        if (uploadUrl.status === "fulfilled") toast.success("Receipt attached");
        setStep(cameraReturnStep);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAiScanning(false);
      setUploading(false);
    }

    setCameraPreview(null);
    setCameraFile(null);
  };
  const retakePhoto = () => {
    setCameraPreview(null);
    setCameraFile(null);
    // Re-request stream from a user gesture for maximum compatibility.
    void requestCameraStream();
  };
  
  useEffect(() => {
    if (step === "camera") {
      // Attach an already-requested stream (if any). Otherwise user can tap Enable Camera.
      void startCamera();
    }
    return () => stopCamera();
  }, [step]); // eslint-disable-line

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

  const quickComputedAmount = useMemo(() => {
    if (mode !== "expense") return quickAmount;
    if (quickCategory === "labor" && quickHours && quickRate) {
      const a = parseFloat(quickHours) * parseFloat(quickRate);
      return Number.isFinite(a) ? a.toFixed(2) : quickAmount;
    }
    if (quickCategory === "materials" && quickQty && quickUnitPrice) {
      const a = parseFloat(quickQty) * parseFloat(quickUnitPrice);
      return Number.isFinite(a) ? a.toFixed(2) : quickAmount;
    }
    return quickAmount;
  }, [mode, quickAmount, quickCategory, quickHours, quickRate, quickQty, quickUnitPrice]);

  // ── Quick submit ──
  const submitQuick = async () => {
    const amount = parseFloat(quickComputedAmount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");

    const entry: LastEntry = {
      mode,
      vendor: quickVendor.trim(),
      amount: quickComputedAmount,
      category: quickCategory,
      project_id: quickProject,
      notes: quickNote.trim(),
    };

    if (mode === "expense") {
      if (!quickVendor.trim()) return toast.error("Vendor is required");
      await createExpense.mutateAsync({
        project_id: quickProject !== "none" ? quickProject : null,
        account_id: accounts[0]?.id ?? null,
        date: quickDate,
        category: quickCategory,
        vendor: quickVendor.trim(),
        description: quickNote.trim() || null,
        amount,
        hours: quickCategory === "labor" && quickHours ? parseFloat(quickHours) : null,
        rate: quickCategory === "labor" && quickRate ? parseFloat(quickRate) : null,
        quantity: quickCategory === "materials" && quickQty ? parseFloat(quickQty) : null,
        unit_price: quickCategory === "materials" && quickUnitPrice ? parseFloat(quickUnitPrice) : null,
        payment_method: "Credit Card",
        payment_status: "paid",
        receipt_url: quickReceiptUrl,
        notes: null,
      });
    } else {
      await createIncome.mutateAsync({
        project_id: quickProject !== "none" ? quickProject : null,
        account_id: accounts[0]?.id ?? null,
        date: quickDate,
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
      const isPdf = file.type === "application/pdf";

      const [uploadRes, aiRes] = await Promise.allSettled([
        receiptsApi.upload(file),
        !isPdf && isAIEnabled()
          ? new Promise<ReceiptData>((resolve, reject) => {
              const r = new FileReader();
              r.onload = async () => {
                try {
                  const dataUrl = r.result as string;
                  const ai = await analyzeReceipt(dataUrl);
                  resolve(ai);
                } catch (err) {
                  reject(err);
                }
              };
              r.onerror = () => reject(new Error("Could not read image"));
              r.readAsDataURL(file);
            })
          : Promise.resolve(null),
      ]);

      if (uploadRes.status === "fulfilled") {
        setForm((f) => ({ ...f, receipt_url: uploadRes.value }));
      }

      if (aiRes.status === "fulfilled" && aiRes.value) {
        applyReceiptAI(aiRes.value);
        toast.success("Receipt scanned — review & save");
      } else {
        toast.success(isPdf ? "PDF attached" : "Receipt attached");
      }
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

  function normalizePaymentMethod(pm: string | null | undefined): string {
    if (!pm) return "Credit Card";
    const s = String(pm).trim();
    const match = PAYMENT_METHODS.find((m) => m.toLowerCase() === s.toLowerCase());
    if (match) return match;
    // Map a few common variants
    if (/cash/i.test(s)) return "Cash";
    if (/debit/i.test(s)) return "Debit Card";
    if (/credit/i.test(s)) return "Credit Card";
    if (/check/i.test(s)) return "Check";
    return "Other";
  }

  function formatReceiptNotes(ai: ReceiptData): string {
    const parts: string[] = [];
    if (ai.vendor_address) parts.push(`Address: ${ai.vendor_address}`);
    if (ai.vendor_phone) parts.push(`Phone: ${ai.vendor_phone}`);
    if (ai.receipt_number) parts.push(`Receipt #: ${ai.receipt_number}`);
    if (ai.card_last4) parts.push(`Card: •••• ${ai.card_last4}`);
    if (ai.subtotal != null || ai.tax != null || ai.tip != null || ai.total != null) {
      parts.push(
        `Subtotal: ${ai.subtotal ?? "—"} | Tax: ${ai.tax ?? "—"} | Tip: ${ai.tip ?? "—"} | Total: ${ai.total ?? ai.amount ?? "—"}`,
      );
    }
    if (ai.line_items?.length) {
      parts.push("Items:");
      for (const li of ai.line_items.slice(0, 18)) {
        const qty = li.quantity != null ? `${li.quantity} × ` : "";
        const unit = li.unit_price != null ? `$${li.unit_price.toFixed(2)}` : "";
        const total = li.total != null ? `$${li.total.toFixed(2)}` : "";
        const rhs = [unit, total].filter(Boolean).join(" → ");
        parts.push(`- ${qty}${li.description}${rhs ? ` (${rhs})` : ""}`);
      }
      if (ai.line_items.length > 18) parts.push(`… +${ai.line_items.length - 18} more`);
    }
    return parts.join("\n").trim();
  }

  function applyReceiptAI(ai: ReceiptData) {
    setAiResult(ai);

    // Receipt capture is for expenses.
    setMode("expense");

    if (ai.vendor) {
      handleVendorChange(ai.vendor);
      setForm((f) => ({ ...f, vendor: ai.vendor ?? "" }));
    }

    const amount = (typeof ai.total === "number" ? ai.total : (typeof ai.amount === "number" ? ai.amount : null));
    if (amount != null) {
      setQuickAmount(String(amount));
      setForm((f) => ({ ...f, amount: String(amount) }));
    }

    if (ai.category) {
      setQuickCategory(ai.category);
      setCategory(ai.category);
    }
    if (ai.date) setForm((f) => ({ ...f, date: ai.date! }));
    if (ai.payment_method) setForm((f) => ({ ...f, payment_method: normalizePaymentMethod(ai.payment_method) }));

    if (ai.description) {
      setQuickNote(ai.description);
      setForm((f) => ({ ...f, description: ai.description ?? "" }));
    }

    // Put deep receipt details into Notes (reviewable/editable).
    const receiptNotes = formatReceiptNotes(ai);
    if (receiptNotes) {
      setForm((f) => ({ ...f, notes: f.notes ? `${f.notes}\n\n${receiptNotes}` : receiptNotes }));
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "h-[96vh] sm:max-w-xl sm:mx-auto rounded-t-[28px] p-0 flex flex-col",
          "border border-black/5",
          "bg-white shadow-2xl",
        )}
      >
        {/* top spacer (no stripe) */}
        <div className="h-2" />

        {/* Header */}
        <SheetHeader className="p-4 pb-2 text-left">
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
                className={cn(
                  "hidden sm:inline-flex",
                  "ml-auto inline-flex items-center gap-1",
                  "h-9 px-3 rounded-xl",
                  "bg-emerald-600 hover:bg-emerald-700",
                  "text-xs font-semibold text-white",
                  "border border-emerald-700/30",
                  "shadow-sm hover:shadow transition"
                )}
              >
                Advanced entry <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </SheetTitle>

          {/* Mobile: keep Advanced entry separate from the sheet close (X) button */}
          {step === "quick" && (
            <button
              onClick={() => setStep("pick")}
              className={cn(
                "sm:hidden",
                "mt-2 w-full inline-flex items-center justify-center gap-2",
                "h-11 rounded-2xl",
                "bg-emerald-600 hover:bg-emerald-700",
                "text-sm font-semibold text-white",
                "shadow-sm transition",
              )}
            >
              Advanced entry <ChevronRight className="w-4 h-4" />
            </button>
          )}
          <SheetDescription className="sr-only">
            {step === "quick" ? "Fast entry — 5 seconds" : "Full entry form"}
          </SheetDescription>
        </SheetHeader>

        {/* ── QUICK MODE ── */}
        {step === "quick" && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
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
                value={quickComputedAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                className="w-full pl-10 pr-4 h-16 text-3xl font-display font-bold bg-muted rounded-xl border-2 border-transparent focus:border-primary outline-none transition"
              />
            </div>

            {/* Project + Category (compact) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Project</label>
                <div className="flex items-center gap-2">
                  <Select value={quickProject} onValueChange={setQuickProject}>
                    <SelectTrigger className="h-11 bg-white border-black/10"><SelectValue placeholder="Project" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {activeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => setProjectOpen(true)}
                    className={cn(
                      "h-11 w-11 rounded-2xl shrink-0",
                      "bg-white",
                      "border border-black/10",
                      "text-foreground",
                      "flex items-center justify-center",
                      "shadow-sm",
                      "hover:bg-muted transition",
                    )}
                    title="Create project"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Date (Quick Add) */}
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="h-11 bg-white border-black/10"
                />
              </div>

              {mode === "expense" ? (
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Category</label>
                  <Select value={quickCategory} onValueChange={(v) => setQuickCategory(v as ExpenseCategory)}>
                    <SelectTrigger className="h-11 bg-white border-black/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((k) => {
                        const Icon = CAT_META[k].icon;
                        return (
                          <SelectItem key={k} value={k}>
                            <span className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              {CAT_META[k].label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Status</label>
                  <div className="h-11 rounded-2xl bg-white border border-black/10 flex items-center px-3 text-sm text-muted-foreground">
                    Paid income
                  </div>
                </div>
              )}
            </div>

            {/* Category-specific inputs (expense) */}
            {mode === "expense" && quickCategory === "labor" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Hours</Label>
                  <Input value={quickHours} onChange={(e) => setQuickHours(e.target.value)} type="number" inputMode="decimal" className="h-11" placeholder="e.g. 6" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Rate</Label>
                  <Input value={quickRate} onChange={(e) => setQuickRate(e.target.value)} type="number" inputMode="decimal" className="h-11" placeholder="$ / hr" />
                </div>
              </div>
            )}

            {mode === "expense" && quickCategory === "materials" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Quantity</Label>
                  <Input value={quickQty} onChange={(e) => setQuickQty(e.target.value)} type="number" inputMode="decimal" className="h-11" placeholder="e.g. 12" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Unit Price</Label>
                  <Input value={quickUnitPrice} onChange={(e) => setQuickUnitPrice(e.target.value)} type="number" inputMode="decimal" className="h-11" placeholder="$" />
                </div>
              </div>
            )}

            {/* Vendor / Client with voice */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-2">
                {mode === "income" ? "Client" : "Vendor"} <span className="normal-case font-normal">(required)</span>
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
                  className="h-11 pr-[92px]"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  <VendorPicker
                    vendors={vendors as any}
                    value={quickVendor}
                    onPick={(name, cat) => {
                      pickVendorSuggestion(name, cat);
                    }}
                  />
                  {quickVendorVoice.supported && (
                    <button
                      type="button"
                      onMouseDown={() => {
                        stopOtherVoiceSessions();
                        quickVendorVoice.listening ? quickVendorVoice.stop() : quickVendorVoice.start();
                      }}
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition",
                        quickVendorVoice.listening
                          ? "bg-primary text-white animate-pulse"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Voice input vendor"
                    >
                      {quickVendorVoice.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  )}
                </div>
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
                    onMouseDown={() => {
                      stopOtherVoiceSessions();
                      quickNoteVoice.listening ? quickNoteVoice.stop() : quickNoteVoice.start();
                    }}
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
              onClick={() => {
                setCameraReturnStep("quick");
                setStep("camera");
                // Request the camera stream from a user gesture for maximum device compatibility.
                void requestCameraStream();
              }}
              className={cn(
                "w-full flex items-center gap-2 h-11 rounded-2xl border border-dashed",
                "text-xs transition bg-white",
                quickReceiptUrl
                  ? "border-primary/40 text-primary hover:border-primary"
                  : "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
              )}
            >
              <Camera className="w-3.5 h-3.5 ml-3" />
              {quickReceiptUrl ? "Receipt attached — tap to replace" : "Scan / upload receipt"}
              {quickReceiptUrl && (
                <span className="ml-auto mr-3 text-[10px] font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                  Attached
                </span>
              )}
            </button>

            {/* AI Voice Assistant */}
            <Collapsible open={assistantOpen} onOpenChange={setAssistantOpen}>
              <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="text-left min-w-0">
                      <div className="text-xs font-semibold tracking-wide text-muted-foreground">AI Voice Assistant</div>
                      <div className="font-display font-bold mt-0.5 text-sm">Speak to fill this {mode === "income" ? "income" : "expense"}.</div>
                    </button>
                  </CollapsibleTrigger>

                  <button
                    type="button"
                    onClick={() => {
                      stopOtherVoiceSessions();
                      assistantVoice.listening ? assistantVoice.stop() : assistantVoice.start();
                    }}
                    className={cn(
                      "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
                      assistantBusy ? "bg-muted" : "bg-surface-dark",
                      assistantVoice.listening ? "ring-2 ring-primary" : "",
                    )}
                    aria-label="Talk to AI"
                    disabled={assistantBusy}
                  >
                    {assistantBusy ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" /> : assistantVoice.listening ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
                  </button>
                </div>

                <CollapsibleContent>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Example: {mode === "income"
                      ? "“ACME Homes, 2,500 dollars, Riverside project invoice 1042”"
                      : "“Home Depot, 186 dollars, materials for Riverside project”"}
                  </div>
                  {assistantPrompt && (
                    <div className="mt-2 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-2 rounded-xl">
                      {assistantPrompt}
                    </div>
                  )}
                  {assistantLastHeard && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Heard: <span className="font-medium text-foreground">{assistantLastHeard}</span>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>

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
                className={cn(
                  "aspect-[2.2/1] rounded-2xl",
                  "bg-emerald-600",
                  "text-white p-4 flex flex-col justify-between text-left",
                  "shadow-sm border border-emerald-700/30",
                  "hover:bg-emerald-700",
                  "active:scale-95 transition",
                )}
              >
                <DollarSign className="w-7 h-7" />
                <div><div className="font-display font-bold text-lg">Income</div><div className="text-xs text-white/80">Client payment</div></div>
              </button>
              <button
                onClick={() => { setMode("expense"); setCategory("other"); setStep("form"); }}
                className={cn(
                  "aspect-[2.2/1] rounded-2xl",
                  "bg-surface-dark",
                  "text-white p-4 flex flex-col justify-between text-left",
                  "shadow-sm border border-black/10",
                  "hover:opacity-95",
                  "active:scale-95 transition",
                )}
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
                  className={cn(
                    "aspect-square rounded-2xl",
                    "bg-surface-dark",
                    "text-white p-3 flex flex-col justify-between text-left",
                    "shadow-sm border border-black/10",
                    "hover:opacity-95",
                    "active:scale-95 transition",
                  )}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                    <t.icon className="w-5 h-5" />
                  </div>
                  <div className="font-display font-bold text-sm leading-tight">{CATEGORY_LABELS[t.type]}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setMode("expense");
                setCategory("other");
                setCameraReturnStep("pick");
                setStep("camera");
                void requestCameraStream();
              }}
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
                      <p className="text-white/60 text-xs">Extracting vendor, address, date, totals & line items</p>
                    </div>
                  )}
                </div>
                {isAIEnabled() && !aiScanning && (
                  <div className="px-5 pt-3 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">AI will auto-fill vendor, address, date, totals, payment method and line items</p>
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
                  {/* Upload: PDF/JPG/PNG */}
                  <label
                    className="w-12 h-12 rounded-full bg-muted flex items-center justify-center cursor-pointer"
                    title="Upload photo or PDF"
                  >
                    <ReceiptIcon className="w-5 h-5 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        // Stop live camera if active.
                        stopCamera();

                        // PDFs: upload immediately (no preview/AI vision)
                        if (file.type === "application/pdf") {
                          setUploading(true);
                          try {
                            const url = await receiptsApi.upload(file);
                            setForm((f) => ({ ...f, receipt_url: url }));
                            setQuickReceiptUrl(url);
                            toast.success("PDF attached");
                            setStep(cameraReturnStep);
                          } catch (err: any) {
                            toast.error(err.message);
                          } finally {
                            setUploading(false);
                          }
                          return;
                        }

                        // Images: show preview, allow AI scan
                        setCameraFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => setCameraPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>

                  {/* Camera action */}
                  {!cameraActive ? (
                    <button
                      onClick={() => void requestCameraStream()}
                      className="flex-1 mx-4 h-12 rounded-2xl bg-surface-dark text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition"
                    >
                      <Camera className="w-4 h-4" /> Enable camera
                    </button>
                  ) : (
                    <button
                      onClick={capturePhoto}
                      className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition active:scale-90 flex items-center justify-center"
                      title="Take photo"
                    >
                      <div className="w-12 h-12 rounded-full bg-white" />
                    </button>
                  )}

                  {/* Fallback to manual form */}
                  <button
                    onClick={() => {
                      stopCamera();
                      setCameraPreview(null);
                      setCameraFile(null);
                      setStep("form");
                    }}
                    className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"
                    title="Skip camera"
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
                    onMouseDown={() => {
                      stopOtherVoiceSessions();
                      descVoice.listening ? descVoice.stop() : descVoice.start();
                    }}
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
                  <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleReceipt} />
                </label>

                {aiResult && (
                  <div className="mt-3 rounded-2xl border border-black/5 bg-white/65 backdrop-blur-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold tracking-wide text-muted-foreground">AI extracted</div>
                        <div className="font-display font-bold mt-1 truncate">{aiResult.vendor ?? "Vendor"}</div>
                        {aiResult.vendor_address && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">{aiResult.vendor_address}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {(aiResult.date ?? form.date) && <span>{aiResult.date ?? form.date}</span>}
                          {(aiResult.payment_method || aiResult.card_last4) && (
                            <span>
                              {" "}· {aiResult.payment_method ?? ""}{aiResult.card_last4 ? ` •••• ${aiResult.card_last4}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</div>
                        <div className="font-display font-bold text-lg text-foreground">
                          ${Number(aiResult.total ?? aiResult.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {aiResult.line_items?.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Line items</div>
                        <div className="mt-2 space-y-1 max-h-40 overflow-auto pr-1">
                          {aiResult.line_items.slice(0, 12).map((li, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <div className="truncate text-foreground/90">{li.description || "Item"}</div>
                                <div className="text-muted-foreground">
                                  {li.quantity != null ? `${li.quantity}×` : ""} {li.unit_price != null ? `$${li.unit_price.toFixed(2)}` : ""}
                                </div>
                              </div>
                              <div className="font-mono tabular-nums text-foreground/90">
                                {li.total != null ? `$${li.total.toFixed(2)}` : ""}
                              </div>
                            </div>
                          ))}
                          {aiResult.line_items.length > 12 && (
                            <div className="text-xs text-muted-foreground">+{aiResult.line_items.length - 12} more…</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                    onMouseDown={() => {
                      stopOtherVoiceSessions();
                      notesVoice.listening ? notesVoice.stop() : notesVoice.start();
                    }}
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

        {/* Inline Create Project dialog */}
        <Sheet open={projectOpen} onOpenChange={setProjectOpen}>
          <SheetContent side="bottom" className="h-[60vh] sm:max-w-xl sm:mx-auto rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle className="font-display text-2xl">Create Project</SheetTitle>
              <SheetDescription>Make a project now, then keep logging.</SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Project Name</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Riverside Tower"
                  className="h-11 mt-1.5"
                />
              </div>
              <Button
                disabled={!projectName.trim() || createProject.isPending}
                className="w-full h-11 bg-gradient-primary shadow-red"
                onClick={async () => {
                  const name = projectName.trim();
                  if (!name) return;
                  try {
                    const created = await createProject.mutateAsync({ name, status: "active" } as any);
                    setProjectName("");
                    setProjectOpen(false);
                    if (created?.id) setQuickProject(created.id);
                    toast.success("Project created");
                  } catch {
                    // handled in hook
                  }
                }}
              >
                <Plus className="w-4 h-4" /> Create Project
              </Button>
            </div>
          </SheetContent>
        </Sheet>
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
