"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

const STORAGE_KEY = "selected_division";

export interface Division {
  id: number;
  name: string;
  code: string;
  is_primary: boolean;
  can_read: boolean;
  can_write: boolean;
  can_approve: boolean;
  can_export: boolean;
}

export interface Workspace {
  role: string | null;
  role_name: string | null;
  is_global_scope: boolean;
  organization_overview: boolean;
  default_division: number | null;
  divisions: Division[];
  permissions: Record<string, string[]>;
}

interface DivisionContextValue {
  workspace?: Workspace;
  divisions: Division[];
  selectedDivisionId: number | null;
  selectedDivision?: Division;
  isOrganizationView: boolean;
  divisionKey: string;
  params: Record<string, number>;
  setDivision: (id: number | null) => void;
  can: (module: string, action: string) => boolean;
  loading: boolean;
  error: unknown;
}

const DivisionContext = createContext<DivisionContextValue | null>(null);

function readStored(): number | null | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return undefined;
  if (raw === "all") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DivisionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<number | null | undefined>(undefined);
  const query = useQuery({
    queryKey: ["workspace"],
    queryFn: async () => (await api.get<Workspace>("/auth/workspace/")).data,
    enabled: typeof window !== "undefined" && !!getToken(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    const workspace = query.data;
    if (!workspace) return;
    const ids = new Set(workspace.divisions.map((division) => division.id));
    const stored = readStored();
    let next: number | null;
    if (workspace.divisions.length === 1) {
      next = workspace.divisions[0].id;
    } else if (stored === null) {
      next = workspace.is_global_scope ? null : workspace.default_division;
    } else if (typeof stored === "number" && ids.has(stored)) {
      next = stored;
    } else if (workspace.is_global_scope) {
      next = null;
    } else {
      next = workspace.default_division;
    }
    // The workspace arrives asynchronously; seed the selector once from the
    // persisted choice or the role default, then let user changes win.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((current) => (current === undefined ? next : current));
  }, [query.data]);

  const setDivision = (id: number | null) => {
    setSelected(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id === null ? "all" : String(id));
    }
  };

  const value = useMemo<DivisionContextValue>(() => {
    const workspace = query.data;
    const divisions = workspace?.divisions ?? [];
    const selectedDivisionId =
      selected === undefined ? (workspace?.default_division ?? null) : selected;
    const selectedDivision = divisions.find(
      (division) => division.id === selectedDivisionId,
    );
    return {
      workspace,
      divisions,
      selectedDivisionId,
      selectedDivision,
      isOrganizationView: selectedDivisionId === null,
      divisionKey: selectedDivisionId === null ? "all" : String(selectedDivisionId),
      params:
        selectedDivisionId === null
          ? {}
          : ({ business_unit: selectedDivisionId } as Record<string, number>),
      setDivision,
      can: (module, action) =>
        Boolean(workspace?.permissions?.[module]?.includes(action)),
      loading: query.isLoading,
      error: query.error,
    };
  }, [query.data, query.isLoading, query.error, selected]);

  return (
    <DivisionContext.Provider value={value}>{children}</DivisionContext.Provider>
  );
}

export function useDivision() {
  const context = useContext(DivisionContext);
  if (!context) {
    throw new Error("useDivision must be used inside DivisionProvider");
  }
  return context;
}
