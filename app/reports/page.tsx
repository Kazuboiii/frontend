"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { useDivision } from "@/lib/division";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Column = { key: string; label: string; type?: string };
type ReportSpec = {
  key: string;
  title: string;
  module: string;
  description: string;
  columns: Column[];
  totals: string[];
  filters: string[];
};
type ReportRun = {
  key: string;
  title: string;
  module: string;
  description: string;
  columns: Column[];
  rows: Record<string, any>[];
  totals: Record<string, number>;
  count: number;
  page: number;
  pages: number;
  generated_at: string;
  division: { id: number; name: string; code: string } | null;
  aggregate: boolean;
};
type Catalog = {
  reports: ReportSpec[];
  permissions: { can_export: Record<string, boolean> };
};

const money = new Intl.NumberFormat("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatCell(column: Column, value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (column.type === "money") {
    const number = Number(value);
    return Number.isFinite(number) ? money.format(number) : String(value);
  }
  if (column.type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat("en-NP").format(number) : String(value);
  }
  if (column.type === "boolean") return value ? "Yes" : "No";
  if (column.type === "datetime") return new Date(value).toLocaleString();
  if (column.type === "date") return String(value).slice(0, 10);
  return String(value);
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] as string);
}

export default function ReportsPage() {
  const { params, divisionKey, selectedDivision, isOrganizationView, can } = useDivision();
  const [reportKey, setReportKey] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");

  const catalog = useQuery({
    queryKey: ["report-catalog"],
    queryFn: async () => (await api.get<Catalog>("/reports/catalog/")).data,
  });

  const defaultReportKey = useMemo(() => {
    const reports = catalog.data?.reports ?? [];
    return reports.find((report) => report.key === "management-overview")?.key ?? reports[0]?.key ?? "";
  }, [catalog.data]);
  const activeReportKey = reportKey || defaultReportKey;

  const reportParams = useMemo(() => ({
    ...params,
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    page,
    page_size: 50,
  }), [params, start, end, status, search, page]);

  const report = useQuery({
    queryKey: ["report-run", activeReportKey, divisionKey, start, end, status, search, page],
    queryFn: async () => (await api.get<ReportRun>(`/reports/run/${activeReportKey}/`, { params: reportParams })).data,
    enabled: Boolean(activeReportKey),
  });

  const selectedSpec = catalog.data?.reports.find((spec) => spec.key === activeReportKey);
  const canExport = selectedSpec ? Boolean(catalog.data?.permissions.can_export[selectedSpec.module]) : false;

  const resetPage = () => setPage(1);

  const download = async (format: "csv" | "xlsx" | "pdf") => {
    if (!activeReportKey) return;
    setDownloading(format);
    setError("");
    try {
      const response = await api.get(`/reports/export/${activeReportKey}/`, {
        params: { ...reportParams, page: undefined, page_size: undefined, format },
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${activeReportKey}-${new Date().toISOString().slice(0, 10)}.${format}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDownloading("");
    }
  };

  const print = () => {
    const data = report.data;
    if (!data) return;
    const title = escapeHtml(data.title);
    const scope = data.division?.name ?? "All accessible divisions";
    const rows = data.rows.map((row) => `<tr>${data.columns.map((column) => `<td>${escapeHtml(formatCell(column, row[column.key]))}</td>`).join("")}</tr>`).join("");
    const totals = data.columns.map((column, index) => index === 0 ? "TOTAL" : (column.key in data.totals ? formatCell(column, data.totals[column.key]) : "")).map(escapeHtml).map((value) => `<th>${value}</th>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:24px;color:#0f172a}
        h1{font-size:20px;margin:0 0 4px} p{color:#475569;font-size:12px;margin:2px 0}
        table{border-collapse:collapse;width:100%;margin-top:16px;font-size:11px}
        th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}
        thead th{background:#0f172a;color:white}
        tfoot th{background:#e2e8f0;text-align:left}
      </style></head><body>
      <h1>${title}</h1>
      <p>${escapeHtml(data.description)}</p>
      <p>Division: ${escapeHtml(scope)} · Rows: ${data.count} · Generated: ${escapeHtml(new Date(data.generated_at).toLocaleString())}</p>
      <table><thead><tr>${data.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${data.columns.length}">No rows.</td></tr>`}</tbody>
      ${Object.keys(data.totals).length ? `<tfoot><tr>${totals}</tr></tfoot>` : ""}</table>
      </body></html>`;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      setError("Allow pop-ups to print this report.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-slate-500">
            {isOrganizationView ? "Organization Overview" : selectedDivision?.name ?? "Selected division"} · every table, total and export uses the same filtered source.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={print} disabled={!report.data}>Print</Button>
          <Button variant="outline" onClick={() => download("csv")} disabled={!canExport || !report.data || downloading !== ""}>{downloading === "csv" ? "Exporting…" : "CSV"}</Button>
          <Button variant="outline" onClick={() => download("xlsx")} disabled={!canExport || !report.data || downloading !== ""}>{downloading === "xlsx" ? "Exporting…" : "Excel"}</Button>
          <Button variant="outline" onClick={() => download("pdf")} disabled={!canExport || !report.data || downloading !== ""}>{downloading === "pdf" ? "Exporting…" : "PDF"}</Button>
        </div>
      </div>

      {(error || report.error || catalog.error) && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {error || errorMessage(report.error || catalog.error)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Report</CardTitle>
          <CardDescription>Choose a report and filter it. Payroll and transport values come from their own source records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm">
              Report
              <select
                className="mt-1 block w-full rounded border p-3"
                value={activeReportKey}
                onChange={(event) => { setReportKey(event.target.value); resetPage(); }}
              >
                {(catalog.data?.reports ?? []).map((spec) => (
                  <option key={spec.key} value={spec.key}>{spec.title} · {spec.module}</option>
                ))}
              </select>
            </label>
            {selectedSpec && <p className="self-end text-sm text-slate-500">{selectedSpec.description}</p>}
          </div>

          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => { event.preventDefault(); setSearch(searchDraft.trim()); resetPage(); }}>
            <label className="text-sm">From<Input type="date" value={start} onChange={(event) => { setStart(event.target.value); resetPage(); }} /></label>
            <label className="text-sm">To<Input type="date" value={end} onChange={(event) => { setEnd(event.target.value); resetPage(); }} /></label>
            <label className="text-sm">Status<Input placeholder="Any status" value={status} onChange={(event) => { setStatus(event.target.value); resetPage(); }} /></label>
            <label className="text-sm">Search<Input placeholder="Search rows" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /></label>
            <div className="flex items-end gap-2">
              <Button type="submit">Apply search</Button>
              <Button type="button" variant="outline" onClick={() => { setStart(""); setEnd(""); setStatus(""); setSearchDraft(""); setSearch(""); resetPage(); }}>Clear</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{report.data?.title ?? "Loading report…"}</CardTitle>
          <CardDescription>
            {report.data ? `${report.data.count} row(s) · page ${report.data.page} of ${report.data.pages} · ${report.data.division?.name ?? "All accessible divisions"}` : "Fetching the latest source data."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <p role="status" className="p-6 text-sm text-slate-500">Loading report…</p>
          ) : report.data ? (
            <>
              <div className="overflow-x-auto rounded border">
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-navy-900 text-white">
                    <tr>{report.data.columns.map((column) => <th key={column.key} className="p-3 text-left font-medium">{column.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {report.data.rows.map((row, index) => (
                      <tr key={index} className="border-b last:border-0 odd:bg-white even:bg-slate-50">
                        {report.data.columns.map((column) => <td key={column.key} className="p-3 align-top">{formatCell(column, row[column.key])}</td>)}
                      </tr>
                    ))}
                    {!report.data.rows.length && <tr><td colSpan={report.data.columns.length} className="p-6 text-center text-slate-400">No rows match these filters.</td></tr>}
                  </tbody>
                  {Object.keys(report.data.totals).length > 0 && (
                    <tfoot className="bg-slate-200 font-semibold">
                      <tr>
                        {report.data.columns.map((column, index) => (
                          <th key={column.key} className="p-3 text-left">{index === 0 ? "TOTAL" : column.key in report.data!.totals ? formatCell(column, report.data!.totals[column.key]) : ""}</th>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Totals are summed from the displayed source rows, not estimated.</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={report.data.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
                  <span>Page {report.data.page} / {report.data.pages}</span>
                  <Button variant="outline" size="sm" disabled={report.data.page >= report.data.pages} onClick={() => setPage((value) => value + 1)}>Next</Button>
                </div>
              </div>
            </>
          ) : (
            <p className="p-6 text-sm text-slate-500">Select a report to begin.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Available reports</CardTitle><CardDescription>Filtered by your role permissions.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(catalog.data?.reports ?? []).map((spec) => (
              <button
                key={spec.key}
                type="button"
                onClick={() => { setReportKey(spec.key); resetPage(); }}
                className={`rounded border p-3 text-left transition hover:border-teal-500 ${spec.key === activeReportKey ? "border-teal-600 bg-teal-50" : "bg-white"}`}
              >
                <span className="block text-sm font-semibold text-navy-900">{spec.title}</span>
                <span className="block text-xs uppercase tracking-wide text-slate-400">{spec.module}</span>
                <span className="mt-1 block text-xs text-slate-500">{spec.description}</span>
              </button>
            ))}
          </div>
          {!can && catalog.data && <p className="mt-4 text-sm text-slate-500">You have read-only access to this report module.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
