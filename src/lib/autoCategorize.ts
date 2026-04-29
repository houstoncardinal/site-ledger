import type { ExpenseCategory, Vendor } from "./types";

// Keyword → category mapping. Longer/more specific phrases take priority.
const RULES: { patterns: RegExp[]; category: ExpenseCategory }[] = [
  // Labor
  {
    patterns: [/payroll|salary|wages|hourly|overtime|worker|crew|staff|employee|laborer|foreman|subpay/i],
    category: "labor",
  },
  // Subcontractor
  {
    patterns: [/subcontract|sub-contract|contract labor|electrician|plumber|hvac|roofer|drywaller|framer|mason|painter|landscap/i],
    category: "subcontractor",
  },
  // Equipment
  {
    patterns: [/rental|rent-a|u-haul|united rentals|sunbelt|ahern|neff|equipment|excavator|crane|forklift|compressor|generator|scaffold|lift|pump/i],
    category: "equipment",
  },
  // Materials — supply stores and material keywords
  {
    patterns: [
      /home depot|lowe['']?s|menards|84 lumber|abc supply|builders|supply co|hardware|lumber|concrete|steel|pipe|wire|conduit|drywall|insulation|roofing|flooring|tile|brick|block|gravel|sand|aggregate|rebar|plywood|osb|sheathing|fastener|nail|screw|bolt|nut|washer/i,
    ],
    category: "materials",
  },
  // COGS
  {
    patterns: [/cogs|cost of goods|raw material|inventory|product|wholesale|distributor/i],
    category: "cogs",
  },
  // Operating
  {
    patterns: [/office|staples|amazon|costco|fuel|gas station|shell|bp|chevron|exxon|mobil|speedway|circle k|7-eleven|insuran|premium|permit|license|registration|tax|accounting|legal|attorney|lawyer|consultant|software|subscription|internet|phone|cell|utility|electric|water|waste|dump|disposal|tool|shop/i],
    category: "operating",
  },
];

export function guessCategoryFromName(vendorName: string): ExpenseCategory | null {
  const name = vendorName.trim();
  if (!name) return null;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(name))) return rule.category;
  }
  return null;
}

/**
 * Returns the best category guess for a given vendor name, using:
 * 1. Known vendor record (learned from history)
 * 2. Keyword-pattern matching
 * 3. null (no guess)
 */
export function autoCategory(vendorName: string, knownVendors: Vendor[]): ExpenseCategory | null {
  if (!vendorName.trim()) return null;
  const q = vendorName.toLowerCase();
  // exact match first
  const exact = knownVendors.find((v) => v.name.toLowerCase() === q);
  if (exact?.default_category) return exact.default_category as ExpenseCategory;
  // partial match (starts with)
  const partial = knownVendors.find((v) => q.startsWith(v.name.toLowerCase()) || v.name.toLowerCase().startsWith(q));
  if (partial?.default_category) return partial.default_category as ExpenseCategory;
  // keyword patterns
  return guessCategoryFromName(vendorName);
}
