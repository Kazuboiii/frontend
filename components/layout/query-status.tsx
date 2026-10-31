"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/lib/api";

export function QueryStatus() {
  const client = useQueryClient();
  const [, changed] = useState(0);
  useEffect(() => { let active = true; const unsubscribe = client.getQueryCache().subscribe(() => queueMicrotask(() => { if (active) changed(n => n + 1); })); return () => { active = false; unsubscribe(); }; }, [client]);
  const errors = client.getQueryCache().getAll().filter(q => q.getObserversCount() > 0 && q.state.status === "error");
  if (!errors.length) return null;
  return <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>Some information could not be loaded. {errorMessage(errors[0].state.error)}</p><button className="mt-2 min-h-11 rounded border px-4" onClick={() => client.refetchQueries({ type: "active" })}>Retry loading</button></div>;
}
