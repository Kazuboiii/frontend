"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api, getApiBase, refreshApi, API_KEY } from "@/lib/api";
import { setTokens, setUser } from "@/lib/auth";
import { ShieldAlert, RefreshCw, Wifi, Loader2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: "Super Administrator", email: "super@buildakar.com", role: "super_admin" },
  { label: "Healthcare Administrator", email: "hcadmin@buildakar.com", role: "healthcare_admin" },
  { label: "Resort Administrator", email: "rsadmin@buildakar.com", role: "resort_admin" },
  { label: "HR Manager", email: "hr@buildakar.com", role: "hr_manager" },
  { label: "Healthcare Inventory Manager", email: "inv@buildakar.com", role: "healthcare_inventory_manager" },
  { label: "Resort Inventory Manager", email: "invrs@buildakar.com", role: "resort_inventory_manager" },
  { label: "Accountant", email: "accountant@buildakar.com", role: "accountant" },
  { label: "Fleet Manager", email: "fleet@buildakar.com", role: "fleet_manager" },
  { label: "Driver", email: "driver@buildakar.com", role: "driver" },
  { label: "Regular Employee", email: "emp@buildakar.com", role: "employee" },
];

export default function LoginPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const networkState = networkLoading
    ? "Checking the network for the UEMS server…"
    : editingUrl
      ? "Update the server URL below."
      : serverUrl
        ? `Connected to ${serverUrl}`
        : "Not connected to a UEMS server yet.";

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login/", data);
      localStorage.setItem("auth_api_base", getApiBase());
      setTokens(res.data.access, res.data.refresh);
      setUser(res.data.user);
      localStorage.removeItem("selected_division");
      // Recreate query caches and division context for the authenticated user.
      window.location.href = "/dashboard";
    } catch (e: any) {
      const msg = e.response?.data?.detail || "Login failed. Try again.";
      setError(msg);
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fill = (email: string) => {
    setValue("email", email);
    setValue("password", "admin123");
  };

  const {
    register,
    handleSubmit,
    setValue,
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
    } catch (e: any) {
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
    } catch (e: any) {
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
                placeholder="super@buildakar.com"
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
        <CardFooter className="pt-6 border-t">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => fill("super@buildakar.com")}>
              Super Admin
            </Button>
            <Button variant="outline" size="sm" onClick={() => fill("hr@buildakar.com")}>
              HR Manager
            </Button>
            <Button variant="outline" size="sm" onClick={() => fill("inv@buildakar.com")}>
              Healthcare Inventory
            </Button>
            <Button variant="outline" size="sm" onClick={() => fill("invrs@buildakar.com")}>
              Resort Inventory
            </Button>
          </div>
        </CardFooter>
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

      <div className="mt-8 w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-5 w-5 text-teal-600" />
          <h3 className="text-sm font-semibold text-navy-900">Demo credentials</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">All accounts use password <span className="font-mono text-navy-900">admin123</span></p>
        <div className="space-y-1">
          {DEMO_ACCOUNTS.map((a) => (
            <div key={a.email} className="flex flex-col gap-1 border-b py-2 text-xs">
              <span className="text-slate-600">{a.label}</span>
              <span className="flex flex-wrap items-center gap-1">
                <span className="font-mono text-navy-900">{a.email}</span>
                <span className="text-slate-400">• {a.role}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
