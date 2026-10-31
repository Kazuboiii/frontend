"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { getToken, setUser } from "@/lib/auth";
import { useDivision } from "@/lib/division";
import { Sidebar } from "./sidebar";
import { QueryStatus } from "./query-status";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    workspace,
    divisions,
    selectedDivisionId,
    isOrganizationView,
    setDivision,
  } = useDivision();
  const publicPage = pathname === "/login" || pathname === "/";
  const ready = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [open, setOpen] = useState(false);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => { const { data } = await api.get("/auth/me/"); setUser(data); return data; },
    enabled: ready && !publicPage && !!getToken(),
    retry: false,
  });
  useEffect(() => {
    if (ready && !publicPage && !getToken()) router.replace("/login");
  }, [ready, publicPage, router]);
  if (publicPage) return children;
  if (!ready || !getToken() || session.isFetching || session.error || !session.data) return <main className="p-8" role="status">{session.error ? <><p>{errorMessage(session.error)}</p><button onClick={() => session.refetch()}>Retry</button></> : "Loading your workspace…"}</main>;
  return <div className="min-h-screen bg-slate-50 lg:pl-64">
    {open && <button className="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <Sidebar open={open} onNavigate={() => setOpen(false)} />
    <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-2 sm:px-6">
      <div className="flex items-center gap-3">
        <button className="min-h-11 rounded border px-3 lg:hidden" aria-expanded={open} onClick={() => setOpen(!open)}>Menu</button>
        <span className="font-semibold text-navy-900">Unified Enterprise Management</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {workspace?.is_global_scope ? (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Division</span>
            <select
              aria-label="Business division"
              className="min-h-10 rounded border bg-white px-3 text-sm text-navy-900"
              value={isOrganizationView ? "all" : String(selectedDivisionId ?? "")}
              onChange={(event) =>
                setDivision(event.target.value === "all" ? null : Number(event.target.value))
              }
            >
              <option value="all">All divisions — Organization Overview</option>
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>{division.name}</option>
              ))}
            </select>
          </label>
        ) : divisions.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Division</span>
            <select
              aria-label="Business division"
              className="min-h-10 rounded border bg-white px-3 text-sm text-navy-900"
              value={String(selectedDivisionId ?? "")}
              onChange={(event) => setDivision(Number(event.target.value))}
            >
              {divisions.map((division) => (
                <option key={division.id} value={division.id}>{division.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <span className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">
            {divisions[0]?.name ?? "No division assigned"}
          </span>
        )}
        <span className="hidden text-sm text-slate-500 sm:block">
          {session.data.first_name || session.data.email}
          {workspace?.role_name ? ` · ${workspace.role_name}` : ""}
        </span>
      </div>
    </header>
    <main className="min-w-0 p-4 sm:p-6"><QueryStatus />{children}</main>
  </div>;
}
