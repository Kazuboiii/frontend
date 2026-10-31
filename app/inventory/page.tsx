"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage, listAll } from "@/lib/api";
import { useDivision } from "@/lib/division";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";

type Row = Record<string, any>;

export default function InventoryPage() {
  const client = useQueryClient();
  const { params, divisionKey, selectedDivision, can } = useDivision();
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<Row | null>(null);
  const [operation, setOperation] = useState<"receive" | "issue">("receive");
  const [message, setMessage] = useState("");
  const [showSupplier, setShowSupplier] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);

  const products = useQuery({ queryKey: ["inventory-products", divisionKey], queryFn: () => listAll("/inventory/products/", params) });
  const batches = useQuery({ queryKey: ["inventory-batches", divisionKey], queryFn: () => listAll("/inventory/batches/", params) });
  const locations = useQuery({ queryKey: ["inventory-locations", divisionKey], queryFn: () => listAll("/inventory/locations/", params) });
  const departments = useQuery({ queryKey: ["departments", divisionKey], queryFn: () => listAll("/departments/", params) });
  const movements = useQuery({ queryKey: ["stock-movements", divisionKey], queryFn: () => listAll("/inventory/movements/", params) });
  const alerts = useQuery({ queryKey: ["inventory-alerts", divisionKey], queryFn: () => listAll("/inventory/products/alerts/", params) });
  const lowStock = useQuery({ queryKey: ["inventory-low-stock", divisionKey], queryFn: () => listAll("/inventory/products/low_stock/", params) });
  const expired = useQuery({ queryKey: ["inventory-expired", divisionKey], queryFn: () => listAll("/inventory/products/expired/", params) });
  const nearExpiry = useQuery({ queryKey: ["inventory-near-expiry", divisionKey], queryFn: () => listAll("/inventory/products/near_expiry/", params) });
  const suppliers = useQuery({ queryKey: ["inventory-suppliers", divisionKey], queryFn: () => listAll("/inventory/suppliers/", params) });
  const adjustments = useQuery({ queryKey: ["inventory-adjustments", divisionKey], queryFn: () => listAll("/inventory/adjustments/", params) });

  const rows = products.data || [];
  const productIds = new Set(rows.map((p) => p.id));
  const visibleBatches = (batches.data || []).filter((b) => productIds.has(b.product));
  const batchIds = new Set(visibleBatches.map((b) => b.id));

  const refreshInventory = () => {
    ["inventory-products", "inventory-batches", "stock-movements", "inventory-alerts", "inventory-low-stock", "inventory-expired", "inventory-near-expiry", "inventory-adjustments"].forEach((key) => client.invalidateQueries({ queryKey: [key] }));
  };

  const save = useMutation({
    mutationFn: async (body: Row) => api.post(operation === "receive" ? "/inventory/receipts/" : "/inventory/issues/", body),
    onSuccess: () => {
      setProduct(null);
      setMessage("Stock saved.");
      refreshInventory();
    },
  });
  const lookup = useMutation({ mutationFn: async () => (await api.get("/inventory/products/lookup/", { params: { barcode, ...params } })).data });
  const label = useMutation({ mutationFn: async (id: number) => { const { data } = await api.get(`/inventory/batches/${id}/qr_label/`, { responseType: "blob" }); const url = URL.createObjectURL(data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `batch-${id}.png`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } });
  const createSupplier = useMutation({
    mutationFn: async (body: Row) => api.post("/inventory/suppliers/", body),
    onSuccess: () => { setShowSupplier(false); setMessage("Supplier saved."); client.invalidateQueries({ queryKey: ["inventory-suppliers"] }); },
  });
  const createAdjustment = useMutation({
    mutationFn: async (body: Row) => api.post("/inventory/adjustments/", body),
    onSuccess: () => { setShowAdjustment(false); setMessage("Adjustment submitted for approval."); refreshInventory(); },
  });
  const approveAdjustment = useMutation({
    mutationFn: async (id: number) => api.post(`/inventory/adjustments/${id}/approve/`),
    onSuccess: () => { setMessage("Adjustment approved and posted."); refreshInventory(); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-sm text-slate-500">
          {selectedDivision?.name ?? "All accessible divisions"} · products, batches, receipts, issues and stock history.
        </p>
      </div>

      {alerts.data && alerts.data.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader><CardTitle className="text-red-700">Low Stock Alerts ({alerts.data.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {alerts.data.map((a: any) => (
                <li key={a.id} className="text-sm text-red-800">
                  <strong>{a.product?.name}</strong> — Usable: {a.product?.usable_stock} / Min: {a.product?.min_stock} {a.product?.unit}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {message && <p role="status" className="rounded border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{message}</p>}

      <Card>
        <CardHeader><CardTitle>Barcode lookup</CardTitle><CardDescription>Lookups are limited to the selected division.</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); lookup.mutate(); }}>
            <Input aria-label="Product barcode" placeholder="Enter or scan with a barcode reader" className="sm:max-w-sm" required value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            <Button disabled={lookup.isPending} type="submit">Lookup</Button>
          </form>
          {lookup.data && <p className="mt-3">{lookup.data.name} · {lookup.data.sku} · Usable stock: {lookup.data.usable_stock}</p>}
          {lookup.error && <p role="alert" className="mt-2 text-sm text-red-700">{errorMessage(lookup.error)}</p>}
        </CardContent>
      </Card>

      {product && can("inventory", "create") && (
        <Card>
          <CardHeader><CardTitle>{operation === "receive" ? "Receive" : "Issue"} {product.name}</CardTitle></CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const common = { reference: f.get("reference"), business_unit: product.business_unit };
                save.mutate(operation === "receive"
                  ? { ...common, location: Number(f.get("location")), lines: [{ product: product.id, batch_number: f.get("batch"), quantity: Number(f.get("quantity")), unit_cost: f.get("cost"), expiry_date: f.get("expiry") || null }] }
                  : { ...common, department: Number(f.get("department")), lines: [{ product_batch: Number(f.get("batch_id")), quantity: Number(f.get("quantity")) }] });
              }}
            >
              <label>Reference<Input name="reference" required maxLength={50} /></label>
              <label>Quantity<Input name="quantity" type="number" min="1" step="1" required /></label>
              {operation === "receive" ? (
                <>
                  <label>Location<select className="block w-full rounded border p-3" name="location" required><option value="">Choose location</option>{locations.data?.filter((l) => l.business_unit === product.business_unit && l.is_active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
                  <label>Batch number<Input name="batch" required /></label>
                  <label>Unit cost<Input name="cost" type="number" min="0" step="0.01" required /></label>
                  <label>Expiry date<Input name="expiry" type="date" required={product.is_perishable} /></label>
                </>
              ) : (
                <>
                  <label>Batch<select className="block w-full rounded border p-3" name="batch_id" required><option value="">Choose usable batch</option>{visibleBatches.filter((b) => b.product === product.id && b.usable_quantity > 0).map((b) => <option key={b.id} value={b.id}>{b.batch_number} · {b.usable_quantity} available</option>)}</select></label>
                  <label>Department<select className="block w-full rounded border p-3" name="department" required><option value="">Choose department</option>{departments.data?.filter((d) => d.business_unit === product.business_unit).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                </>
              )}
              <Button disabled={save.isPending} type="submit">Save stock {operation === "receive" ? "receipt" : "issue"}</Button>
              <Button variant="outline" type="button" disabled={save.isPending} onClick={() => setProduct(null)}>Cancel</Button>
              {save.error && <p role="alert" className="text-sm text-red-700">{errorMessage(save.error)}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Products</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              data={rows}
              loading={products.isLoading}
              columns={[
                { key: "sku", label: "SKU" },
                { key: "name", label: "Product" },
                { key: "business_unit_name", label: "Division" },
                { key: "usable_stock", label: "Usable stock" },
                { key: "min_stock", label: "Minimum" },
                { key: "actions", label: "Actions", render: (p: Row) => can("inventory", "create") ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setProduct(p); setOperation("receive"); save.reset(); }}>Receive</Button><Button size="sm" variant="outline" onClick={() => { setProduct(p); setOperation("issue"); save.reset(); }}>Issue</Button></div> : <span className="text-xs text-slate-400">Read only</span> },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stock movements</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              data={(movements.data || []).filter((m) => batchIds.has(m.product_batch))}
              loading={movements.isLoading}
              columns={[
                { key: "reference", label: "Reference" },
                { key: "product_batch_name", label: "Batch" },
                { key: "movement_type", label: "Movement" },
                { key: "quantity", label: "Quantity" },
                { key: "created_at", label: "Time", render: (m: Row) => new Date(m.created_at).toLocaleString() },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Batches</CardTitle></CardHeader>
        <CardContent>
          <DataTable
            data={visibleBatches}
            loading={batches.isLoading}
            columns={[
              { key: "product_name", label: "Product" },
              { key: "batch_number", label: "Batch" },
              { key: "expiry_date", label: "Expiry" },
              { key: "usable_quantity", label: "Usable" },
              { key: "status", label: "Status" },
              { key: "label", label: "Label", render: (b: Row) => <Button variant="outline" size="sm" disabled={label.isPending} onClick={() => label.mutate(b.id)}>Download QR</Button> },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Low Stock Items</CardTitle></CardHeader><CardContent>{lowStock.isLoading ? <p>Loading…</p> : lowStock.data && lowStock.data.length > 0 ? <ul className="space-y-2">{lowStock.data.map((p: any) => <li key={p.id} className="text-sm"><strong>{p.name}</strong> ({p.business_unit_name}) — {p.usable_stock} / {p.min_stock} {p.unit}</li>)}</ul> : <p className="text-sm text-slate-500">No low stock items.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Near Expiry (30 days)</CardTitle></CardHeader><CardContent>{nearExpiry.isLoading ? <p>Loading…</p> : nearExpiry.data && nearExpiry.data.length > 0 ? <ul className="space-y-2">{nearExpiry.data.map((b: any) => <li key={b.id} className="text-sm"><strong>{b.product_name}</strong> — Batch {b.batch_number}, expires {b.expiry_date}, {b.usable_quantity} left</li>)}</ul> : <p className="text-sm text-slate-500">No items nearing expiry.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Expired Stock</CardTitle></CardHeader><CardContent>{expired.isLoading ? <p>Loading…</p> : expired.data && expired.data.length > 0 ? <ul className="space-y-2">{expired.data.map((b: any) => <li key={b.id} className="text-sm text-red-700"><strong>{b.product_name}</strong> — Batch {b.batch_number}, expired {b.expiry_date}, {b.quantity_remaining} remaining</li>)}</ul> : <p className="text-sm text-slate-500">No expired stock.</p>}</CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Suppliers</CardTitle><CardDescription>Division-owned supplier records.</CardDescription></div>
            {can("inventory", "create") && <Button size="sm" variant="outline" onClick={() => setShowSupplier((v) => !v)}>{showSupplier ? "Close" : "Add supplier"}</Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            {showSupplier && selectedDivision && (
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                createSupplier.mutate({ business_unit: selectedDivision.id, code: f.get("code"), name: f.get("name"), phone: f.get("phone"), email: f.get("email") });
              }}>
                <Input name="code" placeholder="Supplier code" required />
                <Input name="name" placeholder="Supplier name" required />
                <Input name="phone" placeholder="Phone" />
                <Input name="email" type="email" placeholder="Email" />
                <Button type="submit" disabled={createSupplier.isPending}>Save supplier</Button>
                {createSupplier.error && <p role="alert" className="text-sm text-red-700">{errorMessage(createSupplier.error)}</p>}
              </form>
            )}
            <DataTable data={suppliers.data || []} loading={suppliers.isLoading} columns={[{ key: "code", label: "Code" }, { key: "name", label: "Supplier" }, { key: "phone", label: "Phone" }, { key: "business_unit_name", label: "Division" }]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Stock adjustments</CardTitle><CardDescription>Draft adjustments need approval before posting.</CardDescription></div>
            {can("inventory", "create") && <Button size="sm" variant="outline" onClick={() => setShowAdjustment((v) => !v)}>{showAdjustment ? "Close" : "New adjustment"}</Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            {showAdjustment && selectedDivision && (
              <form className="grid gap-3" onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                createAdjustment.mutate({ business_unit: selectedDivision.id, reference: f.get("reference"), reason: f.get("reason"), lines: [{ product_batch: Number(f.get("batch")), quantity_delta: Number(f.get("delta")), notes: f.get("notes") || "" }] });
              }}>
                <Input name="reference" placeholder="Adjustment reference" required />
                <select className="rounded border p-3" name="batch" required><option value="">Choose batch</option>{visibleBatches.map((b) => <option key={b.id} value={b.id}>{b.product_name} · {b.batch_number}</option>)}</select>
                <Input name="delta" type="number" placeholder="Quantity change (e.g. -2)" required />
                <Input name="reason" placeholder="Reason" required />
                <Input name="notes" placeholder="Notes (optional)" />
                <Button type="submit" disabled={createAdjustment.isPending}>Submit for approval</Button>
                {createAdjustment.error && <p role="alert" className="text-sm text-red-700">{errorMessage(createAdjustment.error)}</p>}
              </form>
            )}
            <DataTable
              data={adjustments.data || []}
              loading={adjustments.isLoading}
              columns={[
                { key: "reference", label: "Reference" },
                { key: "reason", label: "Reason" },
                { key: "status", label: "Status" },
                { key: "actions", label: "", render: (a: Row) => a.status === "draft" && can("inventory", "approve") ? <Button size="sm" disabled={approveAdjustment.isPending} onClick={() => approveAdjustment.mutate(a.id)}>Approve</Button> : null },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
