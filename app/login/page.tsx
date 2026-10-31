"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, getApiBase } from "@/lib/api";
import { setTokens, setUser } from "@/lib/auth";

type RoleChoice = { code: string; name: string };

export default function LoginPage() {
  const [roles, setRoles] = useState<RoleChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.get("/auth/role-login/").then(({ data }) => {
      if (!Array.isArray(data) || data.length === 0) throw new Error("No roles available");
      if (!cancelled) setRoles(data);
    }).catch(() => {
      if (!cancelled) setError("Could not load roles. Check your connection and try again.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  async function enter(role: RoleChoice) {
    setEntering(role.code);
    setError("");
    try {
      const { data } = await api.post("/auth/role-login/", { role: role.code });
      localStorage.setItem("auth_api_base", getApiBase());
      setTokens(data.access, data.refresh);
      setUser(data.user);
      localStorage.removeItem("selected_division");
      window.location.assign(new URL("/dashboard", window.location.origin).href);
    } catch (error: unknown) {
      const response = error as { response?: { data?: { detail?: string } } };
      setError(response.response?.data?.detail || "Could not open this workspace. Please try again.");
      setEntering(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-3 text-white"><ShieldCheck aria-hidden="true" /></div>
            <div><p className="text-sm text-slate-600">Buildakar Innovation</p>
              <CardTitle className="text-xl">Unified Enterprise Management</CardTitle></div>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Choose your role</h1>
          <CardDescription>Select a role to open its workspace. No email or password needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p role="status" className="flex items-center gap-2 py-6 text-slate-600"><Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading roles...</p> : (
            <div className="grid gap-3" aria-label="Available roles">
              {roles.map((role) => (
                <Button key={role.code} variant="outline" className="h-auto min-h-14 w-full justify-between gap-3 px-4 py-4 text-left whitespace-normal"
                  disabled={entering !== null} onClick={() => enter(role)}>
                  <span>{entering === role.code ? `Opening ${role.name}...` : role.name}</span>
                  {entering === role.code ? <Loader2 aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none" /> : <ChevronRight aria-hidden="true" className="shrink-0" />}
                </Button>
              ))}
            </div>
          )}
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {!loading && roles.length === 0 && <Button variant="outline" onClick={() => { setLoading(true); setError(""); setAttempt((value) => value + 1); }}>Try again</Button>}
          <p className="text-xs leading-relaxed text-slate-500">Shared role access. Activity is recorded under the selected role.</p>
        </CardContent>
      </Card>
    </main>
  );
}
