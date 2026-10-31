"use client";

import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api, getApiBase, refreshApi, API_KEY } from "@/lib/api";
import { setTokens, setUser } from "@/lib/auth";
import { ShieldAlert, RefreshCw, Wifi, Loader2, Pencil, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

// Friendly labels for demo role codes; fall back to the server-provided name.
const DEMO_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  resort_inventory_manager: "Resort Inventory Manager",
  healthcare_inventory_manager: "Pharmacy Inventory Manager",
  hr_manager: "HR Manager",
  accountant: "Finance Manager",
  employee: "Staff",
};

interface DemoAccount {
  email: string;
  name: string;
  role_code: string | null;
  role_name: string | null;
  business_unit: string | null;
}

export default function LoginPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [demoEmail, setDemoEmail] = useState<string | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    try {
      setServerUrl(getApiBase().replace("/api/v1", ""));
    } catch {
      setServerUrl("");
    }
  }, []);

  // The selector is populated by the server (emails and roles only - passwords
  // are never sent to, or stored in, the frontend). Hidden if demo login is
  // not enabled on this server.
  useEffect(() => {
    let cancelled = false;
    api
      .get("/auth/demo-accounts/")
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) setDemoAccounts(res.data);
      })
      .catch(() => {
        /* Demo login unavailable on this server - just hide the selector. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const networkState = networkLoading
    ? "Checking the network for the UEMS server…"
    : editingUrl
      ? "Update the server URL below."
      : serverUrl
        ? `Connected to ${serverUrl}`
        : "Not connected to a UEMS server yet.";

  const completeLogin = (data: { access: string; refresh: string; user: unknown }) => {
    localStorage.setItem("auth_api_base", getApiBase());
    setTokens(data.access, data.refresh);
    setUser(data.user as never);
    localStorage.removeItem("selected_division");
    // Recreate query caches and division context for the authenticated user.
    window.location.href = "/dashboard";
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login/", data);
      completeLogin(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      const msg = err.response?.data?.detail || "Login failed. Try again.";
      setError(msg);
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (account: DemoAccount) => {
    setDemoEmail(account.email);
    setError("");
    try {
      const res = await api.post("/auth/demo-login/", { email: account.email });
      completeLogin(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      const msg =
        err.response?.data?.detail ||
        "Demo sign-in failed. Use the email + password form instead.";
      setError(msg);
      toast({ title: "Demo sign-in failed", description: msg, variant: "destructive" });
    } finally {
      setDemoEmail(null);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const startNetworkDetection = async () => {
    setNetworkLoading(true);
    setError("");
    try {
      await refreshApi();
      const base = getApiBase();
      setServerUrl(base.replace("/api/v1", ""));
      toast({ title: "Connected", description: `Now using ${base}.`, variant: "default" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network detection failed.";
      setError(msg);
      toast({ title: "Could not connect", description: msg, variant: "destructive" });
    } finally {
      setNetworkLoading(false);
    }
  };

  const startEditUrl = () => {
    if (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_ALLOW_API_OVERRIDE !== "true") {
      setError("The server URL is managed by deployment configuration.");
      return;
    }
    setEditingUrl(true);
    setServerUrl(getApiBase().replace("/api/v1", ""));
  };

  const saveUrl = async () => {
    if (!serverUrl.trim()) {
      setError("Enter a server URL.");
      return;
    }
    try {
      localStorage.setItem(API_KEY, serverUrl.trim());
      refreshApi();
      setEditingUrl(false);
      setError("");
      toast({ title: "Saved", description: `Now using ${getApiBase()}.`, variant: "default" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Invalid server URL.");
    }
  };

  const cancelEditUrl = () => {
    setEditingUrl(false);
    setError("");
    try {
      setServerUrl(getApiBase().replace("/api/v1", ""));
    } catch {
      setServerUrl("");
    }
  };

  return (
    <div className="flex flex-col gap-6 py-8 min-h-screen w-full items-center justify-center lg:flex-row bg-[#f8fafc] px-4">
      <Card className="w-full max-w-md shadow-xl border border-navy-200/50">
        <CardHeader className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-navy-900 flex items-center justify-center text-white">
              <ShieldAlert size={24} />
            </div>
            <div className="text-left">
              <CardTitle className="text-2xl">Unified Enterprise Management</CardTitle>
              <CardDescription className="text-sm text-slate-600">Buildakar Innovation — Sign in</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@buildakar.com"
                {...register("email")}
                className={cn("input", errors.email && "border-destructive")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                className={cn("input", errors.password && "border-destructive")}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            {error && (
              <div className="rounded bg-red-50 p-3 text-xs text-red-700 border border-red-100">{error}</div>
            )}
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {loading ? <RefreshCw size={16} className="mr-2" /> : null} Sign in
            </Button>
          </form>
        </CardContent>
        {demoAccounts.length > 0 && (
          <CardFooter className="pt-6 border-t flex-col gap-2">
            <Label className="self-start text-slate-600">Quick sign in</Label>
            <div className="w-full space-y-1.5">
              {demoAccounts.map((account) => (
                <Button
                  key={account.email}
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  disabled={demoEmail !== null}
                  onClick={() => demoLogin(account)}
                >
                  <span className="flex flex-col items-start">
                    <span className="font-medium">
                      {DEMO_LABELS[account.role_code ?? ""] ?? account.role_name ?? "Account"}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{account.email}</span>
                  </span>
                  {demoEmail === account.email ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400" />
                  )}
                </Button>
              ))}
            </div>
          </CardFooter>
        )}
      </Card>

      <div className="mt-8 w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          {networkLoading ? (
            <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
          ) : editingUrl ? (
            <Pencil className="h-5 w-5 text-slate-400" />
          ) : (
            <Wifi className="h-5 w-5 text-teal-600" />
          )}
          <h3 className="text-sm font-semibold text-navy-900">
            {networkLoading ? "Connecting…" : editingUrl ? "Edit server" : "Connect to the network"}
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">{networkState}</p>
        <div className="space-y-3">
          {editingUrl ? (
            <div className="space-y-2">
              <Input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://192.168.0.50"
                className={cn("input", errors.email && "border-destructive")}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={cancelEditUrl}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveUrl}>
                  Save server
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Button variant="outline" className="w-full" disabled={networkLoading} onClick={startNetworkDetection}>
                {networkLoading ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" /> Scanning
                  </>
                ) : (
                  <>
                    <Wifi size={14} className="mr-2" /> Auto-detect UEMS server
                  </>
                )}
              </Button>
              <Button variant="link" className="w-full" disabled={networkLoading} onClick={startEditUrl}>
                Enter a server URL manually
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
