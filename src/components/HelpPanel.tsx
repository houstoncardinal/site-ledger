import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  HelpCircle, Plus, FolderKanban, Receipt, Image, Wallet, BarChart2,
  Camera, Mic, FileText, Download, Wifi, WifiOff, Sparkles, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Section {
  icon: any;
  title: string;
  color: string;
  items: { q: string; a: string }[];
}

const SECTIONS: Section[] = [
  {
    icon: Plus,
    title: "New Entry — Quick Add",
    color: "bg-red-50 text-red-600",
    items: [
      {
        q: "How do I add an expense?",
        a: "Tap the red 'New Entry' button in the sidebar (desktop) or the '+' button at the top right on mobile. The Quick Add screen opens — enter the vendor, amount, and category. Tap 'Save Expense' to log it instantly.",
      },
      {
        q: "How do I add income / an invoice?",
        a: "In Quick Add, tap 'Switch to Income' at the bottom of the screen. Enter the client name, amount, invoice number (optional), and link it to a project.",
      },
      {
        q: "What is Quick Mode vs Full Form?",
        a: "Quick Mode is a 3-field screen optimised for speed. If you need to add a payment method, notes, or other details, tap 'More details' to expand the full form.",
      },
      {
        q: "Can I repeat the last entry?",
        a: "Yes. In Quick Add, tap the 'Repeat last' button at the top. The vendor, amount, and category from your most recent entry will be pre-filled.",
      },
      {
        q: "How does voice input work?",
        a: "Tap the microphone icon next to the description field. Speak naturally — for example 'Home Depot 85 dollars materials'. The app will auto-fill what it hears.",
      },
    ],
  },
  {
    icon: Camera,
    title: "Receipt Scanning (AI)",
    color: "bg-violet-50 text-violet-600",
    items: [
      {
        q: "How do I scan a receipt?",
        a: "In Quick Add, tap 'Scan Receipt'. Point your camera at the receipt and tap capture. The AI (powered by GPT-4o Vision) will automatically extract the vendor, amount, date, and category.",
      },
      {
        q: "What if the AI misreads the receipt?",
        a: "All AI-filled fields are pre-filled but editable. Review the form before saving — look for the 'AI filled' badge next to fields that were auto-populated.",
      },
      {
        q: "Do receipts get stored?",
        a: "Yes. Receipt photos are uploaded to secure cloud storage and linked to the transaction. You can browse all receipts in the Receipts gallery.",
      },
      {
        q: "Is an OpenAI API key required?",
        a: "Yes, for AI features. Add your key under VITE_OPENAI_API_KEY in the .env file. Without a key, you can still manually add entries and use the camera to attach a photo (without AI extraction).",
      },
    ],
  },
  {
    icon: FolderKanban,
    title: "Projects",
    color: "bg-blue-50 text-blue-600",
    items: [
      {
        q: "How do I create a project?",
        a: "Go to Projects → New Project. Enter the name, optional client name, address, start date, and budget. All expenses and income can be linked to a project.",
      },
      {
        q: "What does the budget bar show?",
        a: "The progress bar on each project card shows what percentage of the budget has been spent. Green = under 70%, orange = 70–90%, red = over 90%. Budget alerts automatically appear on the Dashboard.",
      },
      {
        q: "How do I mark a project complete?",
        a: "Open the project or go to the Projects list and tap 'Mark complete'. Completed projects are moved to the archive section and excluded from active totals.",
      },
      {
        q: "Can I see all expenses for a project?",
        a: "Yes. Open the project to see a full breakdown — expenses, income, profit margin, and category spend chart. You can also filter the Transactions page by project.",
      },
    ],
  },
  {
    icon: Receipt,
    title: "Transactions & Exports",
    color: "bg-emerald-50 text-emerald-600",
    items: [
      {
        q: "How do I find a specific transaction?",
        a: "Go to Transactions. Use the search bar to find by vendor name or description. Filter by project, category, status (paid/unpaid), or date range using the filter bar.",
      },
      {
        q: "How do I mark an expense as paid?",
        a: "On mobile: swipe left on the transaction to reveal the 'Paid' button. On desktop: hover over the row and click the checkmark icon.",
      },
      {
        q: "How do I export to CSV for my accountant?",
        a: "On the Transactions page, tap 'Export CSV'. The file includes a professional header with company info, all transaction details in clearly labeled columns, and a summary section at the bottom — formatted for easy import into Excel or accounting software.",
      },
      {
        q: "How do I generate a PDF report?",
        a: "Tap 'PDF Report' on the Dashboard or Transactions page. Choose This Week, Last Week, This Month, or Last Month. The report includes KPI summary, expense breakdown by category, income entries, project summary, and full expense detail — all branded for HOU INC.",
      },
      {
        q: "Can I delete a transaction?",
        a: "Yes. On mobile: swipe left to reveal the Delete button. On desktop: hover the row and click the trash icon. Deletion is permanent.",
      },
    ],
  },
  {
    icon: BarChart2,
    title: "Analytics & Intelligence",
    color: "bg-orange-50 text-orange-600",
    items: [
      {
        q: "What is the Intelligence Hub?",
        a: "The Analytics page (accessible from the sidebar) provides deep financial analysis across 6 tabs: Overview, Projects, Categories, Profitability, Anomalies, and Chart Builder.",
      },
      {
        q: "What are AI Insights on the Dashboard?",
        a: "The AI engine analyzes your data and surfaces 1–5 key observations — spending trends, profitability signals, and warnings. These update automatically as you add entries.",
      },
      {
        q: "What is Burn Rate?",
        a: "Burn Rate shows your average daily spend based on recent history, and projects your total spend for the current month. Confidence level reflects how much data is available.",
      },
      {
        q: "What are Anomalies?",
        a: "The anomaly detector flags any expense that is more than 2.5× your average for that vendor, or 3× the average for that category. Review them in Analytics → Anomalies tab.",
      },
      {
        q: "How do I drill down from a chart?",
        a: "Click any bar or section in the Analytics charts to filter the Transactions page to that project or category. The filter is applied automatically via URL parameters.",
      },
    ],
  },
  {
    icon: Image,
    title: "Receipts Gallery",
    color: "bg-pink-50 text-pink-600",
    items: [
      {
        q: "Where are my receipt photos?",
        a: "All receipt images are stored in the Receipts section (sidebar icon). They're displayed as a grid sorted by date and filterable by project and date range.",
      },
      {
        q: "How do I view a receipt full-screen?",
        a: "Tap any thumbnail to open the lightbox viewer. Use the left/right arrows to navigate between receipts. Tap the link icon to open the full-resolution image in a new tab.",
      },
    ],
  },
  {
    icon: Wallet,
    title: "Accounts",
    color: "bg-teal-50 text-teal-600",
    items: [
      {
        q: "What are Accounts used for?",
        a: "Accounts represent your real-world bank accounts, cash, or credit cards. Linking transactions to accounts lets you track your live balance per account.",
      },
      {
        q: "How is the balance calculated?",
        a: "Balance = Starting Balance + all paid income − all paid expenses linked to that account. Credit card accounts show the amount owed (negative balance).",
      },
    ],
  },
  {
    icon: WifiOff,
    title: "Offline Mode",
    color: "bg-yellow-50 text-yellow-600",
    items: [
      {
        q: "Does the app work without internet?",
        a: "Yes. When offline, new entries are saved to a local queue. A badge in the sidebar shows how many entries are pending sync. When your connection returns, they upload automatically.",
      },
      {
        q: "Can I lose data when offline?",
        a: "No. The offline queue is stored in your browser's localStorage and persists across sessions. It only clears after each entry is successfully uploaded to the cloud.",
      },
    ],
  },
];

function AccordionItem({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
      >
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", section.color)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="font-semibold text-sm flex-1">{section.title}</span>
        <span className="text-muted-foreground text-xs mr-1">{section.items.length} topics</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {section.items.map((item, i) => (
            <div key={i} className="px-4 py-3.5 bg-muted/20">
              <div className="text-[13px] font-semibold mb-1">{item.q}</div>
              <div className="text-[12px] text-muted-foreground leading-relaxed">{item.a}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HelpPanel({ open, onOpenChange }: HelpPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="font-display text-lg">Help & Features</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">HOU INC — Bookkeeper AI</p>
            </div>
          </div>
        </SheetHeader>

        <div className="py-4 space-y-2">
          <p className="text-xs text-muted-foreground px-1 pb-2">
            Tap any section to expand documentation for that feature.
          </p>
          {SECTIONS.map((s) => (
            <AccordionItem key={s.title} section={s} />
          ))}

          <div className="mt-4 px-1 py-3 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold">Tips for Tax Season</span>
            </div>
            <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed pl-1">
              <li>• Export CSV monthly and save to a shared folder for your accountant</li>
              <li>• Always attach a receipt photo — it's your audit trail</li>
              <li>• Use Projects to separate job costs by contract</li>
              <li>• Mark invoices as Paid when payment clears your bank</li>
              <li>• PDF reports include a full expense detail section — ideal for quarterly reviews</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
