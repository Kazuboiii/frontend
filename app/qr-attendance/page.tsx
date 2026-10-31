"use client";

import { useState, useEffect, useRef, useId } from "react";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

import { api, listAll, errorMessage } from "@/lib/api";

import { getUserFromStorage, hasRole } from "@/lib/auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import QRCode from "qrcode";

import type { Html5Qrcode } from "html5-qrcode";



type Action = "check_in" | "check_out";

type Token = { token: string; expires_at: string; business_unit_name: string; employee_name?: string };

function QRImage({ token, size = 260 }: { token: Token; size?: number }) {

  const canvas = useRef<HTMLCanvasElement>(null);

  const [error, setError] = useState("");

  useEffect(() => { if (canvas.current) QRCode.toCanvas(canvas.current, token.token, { width: size, margin: 4 }).catch(() => setError("Could not draw the QR code.")); }, [token.token, size]);

  return <div className="space-y-2"><canvas ref={canvas} aria-label="Attendance QR code" className="mx-auto max-w-full"/>{error && <p role="alert">{error}</p>}<p className="text-sm">{token.employee_name || token.business_unit_name}</p><p className="text-xs text-slate-500">Expires {new Date(token.expires_at).toLocaleTimeString()}</p><details><summary className="cursor-pointer text-sm">Show token for manual entry</summary><code className="block break-all rounded bg-slate-100 p-3 text-xs">{token.token}</code></details></div>;

}

function Scanner({ onScan, disabled }: { onScan: (value: string) => void; disabled: boolean }) {

  const id = `scanner-${useId().replaceAll(":", "")}`;

  const instance = useRef<Html5Qrcode | null>(null);

  const pending = useRef<Promise<void> | null>(null);

  const disposed = useRef(false);

  const [active, setActive] = useState(false);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const callback = useRef(onScan); callback.current = onScan;

  const locked = useRef(disabled); locked.current = disabled;

  const captured = useRef(false);

  async function stop() { const scanner = instance.current; if (scanner?.isScanning) await scanner.stop(); if (!disposed.current) setActive(false); }

  useEffect(() => {

    disposed.current = false;

    return () => { disposed.current = true; void (async () => { await pending.current?.catch(() => {}); if (instance.current?.isScanning) await instance.current.stop(); instance.current?.clear(); instance.current = null; })().catch(() => {}); };

  }, []);

  async function scan(file?: File) {

    if (busy || disabled) return;

    setBusy(true); setError(""); captured.current = false;

    const task = (async () => {

      const { Html5Qrcode } = await import("html5-qrcode");

      if (disposed.current) return;

      await stop();

      const scanner = instance.current ??= new Html5Qrcode(id);

      if (file) { const text = await scanner.scanFile(file, true); if (!disposed.current) callback.current(text); }

      else {

        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access needs HTTPS. On the local network, use the installed phone app, upload a QR photo, or enter its token below.");

        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, text => {

          if (captured.current || locked.current || disposed.current) return;

          captured.current = true;

          void stop().catch(() => {});

          callback.current(text);

        }, () => {});

        if (!disposed.current) setActive(true);

      }

    })();

    pending.current = task;

    try { await task; } catch (e) { if (!disposed.current) setError(errorMessage(e)); }

    finally { if (!disposed.current) setBusy(false); }

  }

  return <div className="space-y-3"><div id={id} className="max-w-md overflow-hidden rounded border"/><div className="flex flex-wrap gap-2"><Button disabled={busy || disabled} onClick={() => active ? void stop().catch(e => setError(errorMessage(e))) : void scan()}>{active ? "Stop camera" : "Start camera"}</Button><label className="cursor-pointer rounded border px-3 py-2 text-sm">Scan QR image<input aria-label="Scan QR image" className="block max-w-full text-xs" type="file" accept="image/*" disabled={busy || disabled} onChange={e => { const file = e.target.files?.[0]; if (file) void scan(file); e.target.value = ""; }}/></label></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</div>;

}

export default function QRAttendancePage() {

  const user = getUserFromStorage();
  const [displayOnly, setDisplayOnly] = useState(false);

  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Action>("check_in");

  const [unit, setUnit] = useState(String(user?.business_unit || ""));

  const [manual, setManual] = useState("");

  const [result, setResult] = useState("");

  const [failure, setFailure] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const flight = useRef(false);

  const lastSuccess = useRef("");

  const [now, setNow] = useState(Date.now());

  const canGenerate = hasRole("super_admin") || hasRole("hr_manager");

  const units = useQuery({ queryKey: ["units"], queryFn: () => hasRole("super_admin") ? listAll("/business-units/") : Promise.resolve(user?.business_unit ? [{ id: user.business_unit, name: user.business_unit_name }] : []) });

  const selectedUnit = unit || String(units.data?.[0]?.id || "");

  const qr = useQuery<Token>({ queryKey: ["rotating-qr", selectedUnit, mode], queryFn: async () => (await api.get("/attendance/rotating-qr/", { params: { business_unit: selectedUnit, action: mode } })).data, enabled: !!selectedUnit, refetchInterval: 5000 });

  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listAll("/employees/"), enabled: canGenerate });

  const oneTime = useMutation({ mutationFn: async (body: Record<string, unknown>) => (await api.post<Token>("/attendance/one-time-qr/", body)).data });

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  useEffect(() => { if (new URLSearchParams(window.location.search).get("action") === "check_out") setMode("check_out"); }, []);

  async function verify(raw: string) {

    if (flight.current) return;

    let token = raw.trim();

    if (!token) return;

    try { const parsed = JSON.parse(token); if (typeof parsed.token === "string") token = parsed.token; } catch { /* Raw opaque tokens are supported. */ }

    const key = `${mode}:${token}`;

    if (lastSuccess.current === key) { setFailure("Already recorded. Choose the next action or a new QR."); return; }

    flight.current = true; setSubmitting(true); setResult(""); setFailure("");

    try {

      let response;

      try { response = await api.post("/attendance/rotating-qr/verify/", { token, action: mode }); }

      catch (e: unknown) {

        const err = e as { response?: { status: number; data?: { code?: string } } };

        if (err.response?.status !== 404 || err.response.data?.code !== "one_time_token") throw e;

        response = await api.post("/attendance/one-time-qr/verify/", { token, action: mode });

      }

      lastSuccess.current = key;

      setResult(`${response.data.detail} ${response.data.event.employee_name} · ${mode.replace("_", " ")} · ${new Date(response.data.event.timestamp).toLocaleString()}`);

      await Promise.all(["attendance-events", "dashboard"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));

    } catch (e) { setFailure(errorMessage(e)); }

    finally { flight.current = false; setSubmitting(false); }

  }

  if (displayOnly) return <div className="mx-auto max-w-3xl space-y-6 text-center"><div><h1 className="text-3xl font-bold">Staff attendance</h1><p className="mt-2 text-lg">{mode === "check_in" ? "Check in" : "Check out"} · {qr.data?.business_unit_name}</p><p className="mt-2 text-slate-600">Open HOMS on your phone, sign in to your staff account, then tap Scan Attendance QR.</p></div><Card><CardContent className="p-6">{qr.data && new Date(qr.data.expires_at).getTime() > now ? <QRImage token={qr.data} size={420}/> : <p role="status">Refreshing QR…</p>}{qr.error && <p role="alert">{errorMessage(qr.error)}</p>}</CardContent></Card><p className="text-sm text-slate-500">Live demo QR · Refreshes automatically · One attendance record per staff member</p><Button variant="outline" onClick={() => setDisplayOnly(false)}>Back to QR controls</Button></div>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">QR Attendance</h1><p className="text-sm text-slate-500">Signed in as {user?.email}. Each scan records attendance for your own employee account.</p></div>

    <Button variant="teal" onClick={() => setDisplayOnly(true)}>Show staff QR display</Button>
    <label className="block text-sm">Attendance action<select aria-label="Attendance action" className="ml-3 rounded border p-3" value={mode} disabled={submitting} onChange={e => { setMode(e.target.value as Action); setResult(""); setFailure(""); }}><option value="check_in">Check in</option><option value="check_out">Check out</option></select></label>

    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Workplace QR</CardTitle></CardHeader><CardContent className="space-y-4"><label className="block text-sm">Business unit<select aria-label="Business unit" className="mt-1 block w-full rounded border p-3" value={selectedUnit} onChange={e => setUnit(e.target.value)}>{units.data?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>{qr.error ? <p role="alert">{errorMessage(qr.error)}</p> : qr.data && new Date(qr.data.expires_at).getTime() > now ? <><QRImage token={qr.data}/><p className="text-sm text-teal-700">Refreshes automatically · {Math.max(0, Math.ceil((new Date(qr.data.expires_at).getTime()-now)/1000))} seconds left</p></> : <p role="status">Refreshing workplace QR…</p>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Scan and record</CardTitle></CardHeader><CardContent className="space-y-4"><Scanner onScan={value => void verify(value)} disabled={submitting}/><form className="space-y-3" onSubmit={e => { e.preventDefault(); void verify(manual); }}><label htmlFor="manual-token" className="text-sm">Or enter a QR token</label><Input id="manual-token" value={manual} onChange={e => setManual(e.target.value)} required/><Button type="submit" disabled={submitting || !manual.trim()}>{submitting ? "Verifying…" : "Record attendance"}</Button></form>{result && <p role="status" className="rounded bg-teal-50 p-3 text-teal-800">{result}</p>}{failure && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{failure}</p>}</CardContent></Card></div>

    {canGenerate && <Card><CardHeader><CardTitle>Issue a one-time QR</CardTitle></CardHeader><CardContent><form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); oneTime.mutate({ employee: Number(fd.get("employee")), action: mode, validity_minutes: Number(fd.get("minutes")) }); }}><label className="text-sm">Employee<select name="employee" required className="block max-w-full rounded border p-3"><option value="">Choose an employee</option>{employees.data?.filter(e => e.is_active).map(e => <option key={e.id} value={e.id}>{e.user_name} ({e.employee_id})</option>)}</select></label><label className="text-sm">Valid for (minutes)<Input name="minutes" type="number" min="1" max="1440" defaultValue="5" required/></label><Button disabled={oneTime.isPending} type="submit">Generate QR</Button></form>{oneTime.error && <p role="alert">{errorMessage(oneTime.error)}</p>}{oneTime.data && <QRImage token={oneTime.data}/>}</CardContent></Card>}

  </div>;

}

