"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage, listAll } from "@/lib/api";
import { useDivision } from "@/lib/division";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";

type Employee = {
  id: number;
  employee_id: string;
  user_name: string;
  designation: string | null;
  business_unit: number;
  is_active: boolean;
};

type PayrollLine = {
  id: number;
  employee_name: string;
  employee_code: string;
  basic_salary: string;
  allowances: string;
  deductions: string;
  gross: string;
  net: string;
  days_present: number;
};

type SalaryStructure = {
  id: number;
  employee: number;
  employee_code: string;
  employee_name: string;
  business_unit: number;
  business_unit_name: string;
  currency: string;
  basic_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowance: string;
  tax_rate_percent: string;
  other_deduction: string;
  gross: string;
  effective_from: string;
  is_active: boolean;
};

type PayrollRun = {
  id: number;
  reference: string;
  business_unit: number;
  business_unit_name: string;
  period_start: string;
  period_end: string;
  status: "draft" | "approved" | "paid";
  currency: string;
  created_at: string;
  total_gross: string;
  total_net: string;
  employee_count: number;
  lines: PayrollLine[];
};

const money = new Intl.NumberFormat("en-NP", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function amount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? money.format(number) : "—";
}

function monthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

const DEFAULT_PERIOD = monthBounds();

const statusStyles: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  approved: "bg-teal-100 text-teal-800",
  paid: "bg-slate-200 text-slate-700",
};

export default function PayrollPage() {
  const client = useQueryClient();
  const { params, divisionKey, selectedDivision, isOrganizationView, can } = useDivision();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showStructure, setShowStructure] = useState(false);
  const [periodStart, setPeriodStart] = useState(DEFAULT_PERIOD.start);
  const [periodEnd, setPeriodEnd] = useState(DEFAULT_PERIOD.end);
  const [reference, setReference] = useState("");
  const [expandedRun, setExpandedRun] = useState<number | null>(null);

  const structures = useQuery({
    queryKey: ["payroll-structures", divisionKey],
    queryFn: () => listAll<SalaryStructure>("/payroll/salary-structures/", params),
  });
  const runs = useQuery({
    queryKey: ["payroll-runs", divisionKey],
    queryFn: () => listAll<PayrollRun>("/payroll/runs/", params),
  });
  const employees = useQuery({
    queryKey: ["payroll-employees", divisionKey],
    queryFn: () => listAll<Employee>("/employees/", params),
  });

  const structuredEmployeeIds = useMemo(
    () => new Set((structures.data || []).map((structure) => structure.employee)),
    [structures.data],
  );
  const eligibleEmployees = (employees.data || []).filter(
    (employee) => employee.is_active !== false && !structuredEmployeeIds.has(employee.id),
  );
  const divisionStructures = (structures.data || []).filter(
    (structure) => !selectedDivision || structure.business_unit === selectedDivision.id,
  );
  const divisionRuns = (runs.data || []).filter(
    (run) => !selectedDivision || run.business_unit === selectedDivision.id,
  );

  const canCreate = can("payroll", "create");
  const canUpdate = can("payroll", "update");
  const canApprove = can("payroll", "approve");

  const refresh = () => {
    client.invalidateQueries({ queryKey: ["payroll-structures"] });
    client.invalidateQueries({ queryKey: ["payroll-runs"] });
  };

  const createStructure = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      api.post("/payroll/salary-structures/", body),
    onSuccess: () => {
      setShowStructure(false);
      setError("");
      setMessage("Salary structure saved.");
      client.invalidateQueries({ queryKey: ["payroll-structures"] });
      client.invalidateQueries({ queryKey: ["payroll-employees"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const toggleStructure = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) =>
      api.patch(`/payroll/salary-structures/${id}/`, { is_active: active }),
    onSuccess: () => {
      setError("");
      setMessage("Salary structure updated.");
      client.invalidateQueries({ queryKey: ["payroll-structures"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const calculate = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      api.post("/payroll/runs/calculate/", body),
    onSuccess: (response) => {
      setError("");
      setMessage(
        response.status === 201
          ? `Payroll ${response.data.reference} calculated from salary structures and attendance.`
          : `Payroll ${response.data.reference} already exists; no duplicate was created.`,
      );
      setReference("");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const approve = useMutation({
    mutationFn: async (id: number) => api.post(`/payroll/runs/${id}/approve/`),
    onSuccess: () => {
      setError("");
      setMessage("Payroll run approved.");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const markPaid = useMutation({
    mutationFn: async (id: number) => api.post(`/payroll/runs/${id}/mark_paid/`),
    onSuccess: () => {
      setError("");
      setMessage("Payroll run marked paid.");
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const scopeLabel = isOrganizationView
    ? "Organization Overview"
    : selectedDivision?.name ?? "Selected division";
  const busy = calculate.isPending || approve.isPending || markPaid.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Payroll</h1>
        <p className="text-sm text-slate-500">
          {scopeLabel} · payroll is calculated only from salary structures and attendance days, never from inventory or transport data.
        </p>
      </div>

      {message && <p role="status" className="rounded border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {(structures.error || runs.error) && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage(structures.error || runs.error)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Calculate payroll</CardTitle>
          <CardDescription>
            Choose a period for the selected division. Re-running the same reference returns the existing run instead of duplicating lines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedDivision && (
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Select one division in the header before calculating payroll.
            </p>
          )}
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedDivision) {
                setError("Select one division in the header before calculating payroll.");
                return;
              }
              calculate.mutate({
                business_unit: selectedDivision.id,
                period_start: periodStart,
                period_end: periodEnd,
                reference: reference.trim(),
              });
            }}
          >
            <label className="text-sm">
              Period start
              <Input type="date" required value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </label>
            <label className="text-sm">
              Period end
              <Input type="date" required value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </label>
            <label className="text-sm">
              Reference (optional)
              <Input placeholder="Auto-generated when empty" maxLength={60} value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
            <div className="flex items-end">
              <Button type="submit" disabled={!canCreate || !selectedDivision || busy}>
                {calculate.isPending ? "Calculating…" : "Calculate payroll"}
              </Button>
            </div>
          </form>
          {!canCreate && <p className="text-sm text-slate-500">You have read-only payroll access.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Payroll runs</CardTitle>
            <CardDescription>Draft, approved and paid runs for the current scope.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={divisionRuns}
            loading={runs.isLoading}
            emptyMessage="No payroll runs yet. Calculate one from salary structures."
            columns={[
              { key: "reference", label: "Reference" },
              { key: "business_unit_name", label: "Division" },
              {
                key: "period",
                label: "Period",
                render: (run: PayrollRun) => `${run.period_start} → ${run.period_end}`,
              },
              {
                key: "status",
                label: "Status",
                render: (run: PayrollRun) => (
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${statusStyles[run.status] ?? ""}`}>
                    {run.status}
                  </span>
                ),
              },
              { key: "employee_count", label: "Employees" },
              {
                key: "total_gross",
                label: "Gross",
                render: (run: PayrollRun) => amount(run.total_gross),
              },
              {
                key: "total_net",
                label: "Net",
                render: (run: PayrollRun) => amount(run.total_net),
              },
              {
                key: "actions",
                label: "Actions",
                render: (run: PayrollRun) => (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedRun((current) => (current === run.id ? null : run.id))}
                    >
                      {expandedRun === run.id ? "Hide lines" : "View lines"}
                    </Button>
                    {run.status === "draft" && canApprove && (
                      <Button size="sm" disabled={busy} onClick={() => approve.mutate(run.id)}>Approve</Button>
                    )}
                    {run.status === "approved" && canApprove && (
                      <Button size="sm" disabled={busy} onClick={() => markPaid.mutate(run.id)}>Mark paid</Button>
                    )}
                  </div>
                ),
              },
            ]}
          />

          {expandedRun !== null && (() => {
            const run = divisionRuns.find((item) => item.id === expandedRun);
            if (!run) return null;
            return (
              <div className="mt-4 rounded border">
                <div className="border-b bg-slate-50 px-3 py-2 text-sm font-medium">
                  {run.reference} · {run.lines.length} line(s) · net {amount(run.total_net)} {run.currency}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-sm">
                    <thead className="bg-navy-900 text-white">
                      <tr>
                        <th className="p-2 text-left">Employee</th>
                        <th className="p-2 text-left">Code</th>
                        <th className="p-2 text-left">Basic</th>
                        <th className="p-2 text-left">Allowances</th>
                        <th className="p-2 text-left">Deductions</th>
                        <th className="p-2 text-left">Gross</th>
                        <th className="p-2 text-left">Net</th>
                        <th className="p-2 text-left">Days present</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.lines.map((line) => (
                        <tr key={line.id} className="border-b last:border-0">
                          <td className="p-2">{line.employee_name}</td>
                          <td className="p-2">{line.employee_code}</td>
                          <td className="p-2">{amount(line.basic_salary)}</td>
                          <td className="p-2">{amount(line.allowances)}</td>
                          <td className="p-2">{amount(line.deductions)}</td>
                          <td className="p-2">{amount(line.gross)}</td>
                          <td className="p-2 font-medium">{amount(line.net)}</td>
                          <td className="p-2">{line.days_present}</td>
                        </tr>
                      ))}
                      {!run.lines.length && (
                        <tr><td colSpan={8} className="p-4 text-center text-slate-400">No payroll lines.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Salary structures</CardTitle>
            <CardDescription>One active structure per employee drives payroll for this division.</CardDescription>
          </div>
          {canCreate && selectedDivision && (
            <Button size="sm" variant="outline" onClick={() => setShowStructure((value) => !value)}>
              {showStructure ? "Close" : "Add structure"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showStructure && selectedDivision && (
            <form
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                createStructure.mutate({
                  employee: Number(form.get("employee")),
                  business_unit: selectedDivision.id,
                  currency: form.get("currency") || "NPR",
                  basic_salary: form.get("basic_salary"),
                  housing_allowance: form.get("housing_allowance") || "0",
                  transport_allowance: form.get("transport_allowance") || "0",
                  other_allowance: form.get("other_allowance") || "0",
                  tax_rate_percent: form.get("tax_rate_percent") || "0",
                  other_deduction: form.get("other_deduction") || "0",
                  effective_from: form.get("effective_from"),
                  is_active: true,
                });
              }}
            >
              <label className="text-sm sm:col-span-2">
                Employee
                <select className="mt-1 block w-full rounded border p-3" name="employee" required>
                  <option value="">Choose an employee without a structure</option>
                  {eligibleEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employee_id} · {employee.user_name} · {employee.designation || "No designation"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Currency
                <Input name="currency" defaultValue="NPR" maxLength={8} />
              </label>
              <label className="text-sm">
                Effective from
                <Input name="effective_from" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label className="text-sm">
                Basic salary
                <Input name="basic_salary" type="number" min="0" step="0.01" required />
              </label>
              <label className="text-sm">
                Housing allowance
                <Input name="housing_allowance" type="number" min="0" step="0.01" defaultValue="0" />
              </label>
              <label className="text-sm">
                Transport allowance
                <Input name="transport_allowance" type="number" min="0" step="0.01" defaultValue="0" />
              </label>
              <label className="text-sm">
                Other allowance
                <Input name="other_allowance" type="number" min="0" step="0.01" defaultValue="0" />
              </label>
              <label className="text-sm">
                Tax rate (%)
                <Input name="tax_rate_percent" type="number" min="0" max="100" step="0.01" defaultValue="0" />
              </label>
              <label className="text-sm">
                Other deduction
                <Input name="other_deduction" type="number" min="0" step="0.01" defaultValue="0" />
              </label>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button type="submit" disabled={createStructure.isPending}>
                  {createStructure.isPending ? "Saving…" : "Save structure"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowStructure(false)}>Cancel</Button>
              </div>
              {!eligibleEmployees.length && (
                <p className="text-sm text-amber-700 sm:col-span-2 lg:col-span-4">
                  Every active employee in this division already has a salary structure.
                </p>
              )}
            </form>
          )}

          <DataTable
            data={divisionStructures}
            loading={structures.isLoading}
            emptyMessage="No salary structures for this division."
            columns={[
              { key: "employee_code", label: "Code" },
              { key: "employee_name", label: "Employee" },
              { key: "business_unit_name", label: "Division" },
              { key: "basic_salary", label: "Basic", render: (row: SalaryStructure) => amount(row.basic_salary) },
              { key: "gross", label: "Gross", render: (row: SalaryStructure) => amount(row.gross) },
              { key: "tax_rate_percent", label: "Tax %" },
              { key: "effective_from", label: "Effective" },
              {
                key: "is_active",
                label: "Active",
                render: (row: SalaryStructure) => (row.is_active ? "Yes" : "No"),
              },
              {
                key: "actions",
                label: "",
                render: (row: SalaryStructure) =>
                  canUpdate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggleStructure.isPending}
                      onClick={() => toggleStructure.mutate({ id: row.id, active: !row.is_active })}
                    >
                      {row.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
