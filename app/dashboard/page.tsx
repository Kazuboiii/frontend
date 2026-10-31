"use client";

import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { getUserFromStorage } from "@/lib/auth";
import { useDivision } from "@/lib/division";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatDateTime } from "@/lib/utils";

type Summary = {
  employees: number;
  checked_in_today: number;
  active_vehicles: number;
  pending_requests: number;
  updated_at: string;
  weekly: { day: string; checkins: number; checkouts: number }[];
  recent: { id: number; employee_name: string; business_unit_name: string; action: string; timestamp: string }[];
  inventory: {
    products: number;
    batches: number;
    usable_units: number;
    stock_value: number;
    low_stock: number;
    near_expiry: number;
    expired_batches: number;
    new_products_30d: number;
    restocks_30d: number;
    open_alerts: number;
    pending_adjustments: number;
    open_purchase_orders: number;
  };
  division: { id: number; name: string; code: string } | null;
};

const primaryCards = [
  ["employees", "Active employees"],
  ["checked_in_today", "Checked in today"],
  ["active_vehicles", "Available / in-use vehicles"],
  ["pending_requests", "Pending requests"],
] as const;

const inventoryCards = [
  ["products", "Active products"],
  ["batches", "Batches / lots"],
  ["usable_units", "Usable units"],
  ["stock_value", "Stock value"],
  ["low_stock", "Low stock products"],
  ["near_expiry", "Near expiry (30d)"],
  ["expired_batches", "Expired batches"],
  ["open_alerts", "Open low-stock alerts"],
  ["pending_adjustments", "Pending adjustments"],
  ["open_purchase_orders", "Open purchase orders"],
] as const;

function formatValue(key: string, value: number | undefined) {
  if (value === undefined) return "—";
  if (key === "stock_value") {
    return new Intl.NumberFormat("en-NP", { maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat("en-NP").format(value);
}

export default function DashboardPage() {
  const user = getUserFromStorage();
  const { params, divisionKey, selectedDivision, isOrganizationView } = useDivision();
  const query = useQuery({
    queryKey: ["dashboard", divisionKey],
    queryFn: async () => (await api.get<Summary>("/reports/dashboard/", { params })).data,
    refetchInterval: 30000,
  });
  const data = query.data;
  const scopeLabel = isOrganizationView
    ? "Organization Overview"
    : selectedDivision?.name ?? data?.division?.name ?? "Your division";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back, {user?.first_name || user?.email}. {scopeLabel} at a glance.
          </p>
        </div>
        <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {query.error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {errorMessage(query.error)} {data && "Showing the last successful update."}
        </p>
      )}

      <section aria-label="Workforce and transport">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {primaryCards.map(([key, label]) => (
            <Card key={key}>
              <CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-navy-900">
                  {data ? formatValue(key, data[key]) : "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="Inventory" className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">Inventory</h2>
          <p className="text-sm text-slate-500">
            Live counts from the selected division&apos;s stock records. No mock or estimated values.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {inventoryCards.map(([key, label]) => (
            <Card key={key}>
              <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-slate-500">{label}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-navy-900">
                  {data ? formatValue(key, data.inventory[key]) : "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Attendance activity</CardTitle>
            <CardDescription>Recorded events over the last seven days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 min-w-0">
              {data ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weekly} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tickFormatter={(v) => v.slice(5)} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line name="Check-ins" dataKey="checkins" stroke="#0d9488" strokeWidth={2} />
                    <Line name="Check-outs" dataKey="checkouts" stroke="#334155" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p role="status">{query.isLoading ? "Loading attendance…" : "Attendance unavailable."}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent attendance</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recent.map((event) => (
                <div key={event.id} className="flex justify-between gap-3 border-b pb-3 text-sm">
                  <div>
                    <p className="font-medium">{event.employee_name}</p>
                    <p className="text-slate-500">{event.business_unit_name}</p>
                  </div>
                  <div className="text-right">
                    <p>{event.action.replaceAll("_", " ")}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(event.timestamp)}</p>
                  </div>
                </div>
              ))}
              {data && !data.recent.length && <p>No attendance recorded yet.</p>}
              {!data && <p role="status">{query.isLoading ? "Loading attendance…" : "No data."}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {data && (
        <p className="text-xs text-slate-500">
          Updated {formatDateTime(data.updated_at)} · Dates use the workplace timezone.
        </p>
      )}
    </div>
  );
}
