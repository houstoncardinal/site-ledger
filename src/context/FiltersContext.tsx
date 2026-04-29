import { createContext, useContext, useReducer, type ReactNode } from "react";

export type DateRange = 7 | 30 | 90 | 365 | 0; // 0 = all time

export interface FilterState {
  range: DateRange;
  projectId: string | null;
  category: string | null;
  vendor: string | null;
}

type FilterAction =
  | { type: "SET_RANGE"; range: DateRange }
  | { type: "SET_PROJECT"; projectId: string | null }
  | { type: "SET_CATEGORY"; category: string | null }
  | { type: "SET_VENDOR"; vendor: string | null }
  | { type: "RESET" };

const DEFAULT: FilterState = { range: 30, projectId: null, category: null, vendor: null };

function reducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case "SET_RANGE": return { ...state, range: action.range };
    case "SET_PROJECT": return { ...state, projectId: action.projectId };
    case "SET_CATEGORY": return { ...state, category: action.category };
    case "SET_VENDOR": return { ...state, vendor: action.vendor };
    case "RESET": return DEFAULT;
    default: return state;
  }
}

const FiltersCtx = createContext<{ state: FilterState; dispatch: React.Dispatch<FilterAction> } | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT);
  return <FiltersCtx.Provider value={{ state, dispatch }}>{children}</FiltersCtx.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersCtx);
  if (!ctx) throw new Error("useFilters must be inside FiltersProvider");
  return ctx;
}
