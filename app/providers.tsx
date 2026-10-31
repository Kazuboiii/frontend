"use client";

import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { DivisionProvider } from "@/lib/division";
import { errorMessage } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { ToastProvider } from "@/hooks/use-toast";
import { Toast } from "@/components/ui/toast";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: error => toast({ title: "Could not load data", description: errorMessage(error), variant: "destructive" }) }),
        mutationCache: new MutationCache({ onError: error => toast({ title: "Could not save", description: errorMessage(error), variant: "destructive" }) }),
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DivisionProvider>
        <ToastProvider><AppShell>{children}</AppShell></ToastProvider>
        <Toast />
      </DivisionProvider>
    </QueryClientProvider>
  );
}
