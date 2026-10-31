"use client";

import * as React from "react";
import { useModuleToasts, dismissToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toast() {
  const toasts = useModuleToasts();
  return (
    <div aria-live="polite" className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex w-[min(400px,calc(100vw-40px))] items-center gap-3 rounded-lg border p-4 shadow-lg animate-in fade-in slide-in-from-right-2 duration-300",
            t.variant === "destructive"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-teal-200 bg-teal-50 text-teal-800",
          )}
        >
          <div className="shrink-0">
            {t.variant === "destructive" ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          </div>
          <div className="text-sm leading-none">
            {t.title ? (
              <div className="font-medium">{t.title}</div>
            ) : null}
            {t.description ? (
              <div className="text-xs opacity-80">{t.description}</div>
            ) : null}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="ml-auto opacity-50 hover:opacity-100 transition"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
