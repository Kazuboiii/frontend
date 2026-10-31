"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, listAll } from "@/lib/api";
import { getUserFromStorage } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Send, Truck, Shield, RefreshCw } from "lucide-react";

export default function MedicineDeliveryPage() {
  const user = getUserFromStorage();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["medicine-deliveries"],
    queryFn: async () => {
      return listAll("/medicine-delivery/requests/");
    },
    enabled: !!user,
  });

  const drivers = useQuery({ queryKey: ["fleet-drivers"], queryFn: () => listAll("/fleet/drivers/") });
  const vehicles = useQuery({ queryKey: ["fleet-vehicles"], queryFn: () => listAll("/fleet/vehicles/") });
  const rows = (data || []).map((d: any) => ({
    id: d.id,
    reference: d.reference,
    recipient: d.recipient_name,
    status: d.status,
    driver: drivers.data?.find(x => x.id === d.assigned_driver)?.user_name || "—",
    vehicle: vehicles.data?.find(x => x.id === d.assigned_vehicle)?.license_plate || "—",
  }));

  const actionMut = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) => {
      const r = await api.post(`/medicine-delivery/requests/${id}/${action}/`);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicine-deliveries"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <CardTitle className="text-2xl font-bold text-navy-900">Medicine Delivery</CardTitle>
        <CardDescription>Delivery workflow integrated with inventory stock.</CardDescription>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deliveries</CardTitle>
          <CardDescription>Track medicine delivery status and stock reconciliation.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-b border-border">
              <thead>
                <tr className="text-navy-900 font-medium">
                  <th className="p-3 text-left">Reference</th>
                  <th className="p-3 text-left">Recipient</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Driver</th>
                  <th className="p-3 text-left">Vehicle</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d: any) => {
                  const next = d.status === "requested" ? "reserve" :
                    d.status === "reserved" ? "dispatch" :
                    d.status === "dispatched" ? "deliver" : null;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-xs">{d.reference}</td>
                      <td className="p-3">{d.recipient}</td>
                      <td className="p-3">
                        <Badge variant={d.status === "delivered" ? "success" : d.status === "failed" ? "destructive" : "default"}>
                          {d.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs">{d.driver}</td>
                      <td className="p-3 text-xs">{d.vehicle}</td>
                      <td className="p-3">
                        {next ? (
                          <Button
                            size="sm"
                            onClick={() => actionMut.mutate({ id: d.id, action: next })}
                            disabled={actionMut.isPending}
                            variant="teal"
                          >
                            {actionMut.isPending ? <RefreshCw size={14} /> : null}
                            {next.charAt(0).toUpperCase() + next.slice(1)}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">Complete</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-400 text-xs">{isLoading ? "Loading deliveries…" : "No deliveries."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
