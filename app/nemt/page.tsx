"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, listAll } from "@/lib/api";
import { getUserFromStorage } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Truck, Smartphone, User as UserIcon, MapPin } from "lucide-react";

const STATUS_ORDER: { key: string; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "assigned", label: "Assigned" },
  { key: "started", label: "Started" },
  { key: "picked_up", label: "Picked Up" },
  { key: "dropoffed", label: "Dropped Off" },
  { key: "completed", label: "Completed" },
];

export default function NEMTPage() {
  const user = getUserFromStorage();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["nemt-requests"],
    queryFn: async () => {
      return listAll("/nemt/requests/");
    },
    enabled: !!user,
  });

  const [adding, setAdding] = useState(false);
  const trips = useQuery({ queryKey: ["nemt-trips"], queryFn: () => listAll("/nemt/trips/") });
  const drivers = useQuery({ queryKey: ["fleet-drivers"], queryFn: () => listAll("/fleet/drivers/") });
  const vehicles = useQuery({ queryKey: ["fleet-vehicles"], queryFn: () => listAll("/fleet/vehicles/") });
  const units = useQuery({ queryKey: ["units"], queryFn: () => user?.role_code === "super_admin" ? listAll("/business-units/") : Promise.resolve([{ id: user?.business_unit, name: user?.business_unit_name }]) });
  const assign = useMutation({ mutationFn: (body: Record<string, number>) => api.post("/nemt/trips/", body), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["nemt-trips"] }); queryClient.invalidateQueries({ queryKey: ["nemt-requests"] });
      queryClient.invalidateQueries({ queryKey: ["nemt-trips"] }); } });
  const rows = (data || []).map((r: any) => ({
    id: r.id,
    reference: r.reference,
    patient: r.patient_name,
    pickup: r.pickup_location,
    dropoff: r.dropoff_location,
    trip: trips.data?.find(t => t.request === r.id),
    status: trips.data?.find(t => t.request === r.id)?.status || r.status,
    driver: drivers.data?.find(d => d.id === r.assigned_driver)?.user_name || "—",
    vehicle: vehicles.data?.find(v => v.id === r.assigned_vehicle)?.license_plate || "—",
  }));

  const transitionMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await api.post(`/nemt/trips/${id}/transition/`, { status });
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nemt-requests"] });
      queryClient.invalidateQueries({ queryKey: ["nemt-trips"] });
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await api.post("/nemt/requests/", payload);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nemt-requests"] });
      queryClient.invalidateQueries({ queryKey: ["nemt-trips"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-2xl font-bold text-navy-900">NEMT Transportation</CardTitle>
          <CardDescription>Non-emergency medical transport requests and trips.</CardDescription>
        </div>
        <Button onClick={() => setAdding(!adding)} disabled={!user} variant="teal">
          <Smartphone size={16} className="mr-2" /> New Request
        </Button>
      </div>

      {adding && <Card><CardContent className="p-4"><form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); createMut.mutate({ reference: fd.get("reference"), business_unit: Number(fd.get("unit")), patient_name: fd.get("patient"), pickup_location: fd.get("pickup"), dropoff_location: fd.get("dropoff"), pickup_time: new Date(String(fd.get("time"))).toISOString() }, { onSuccess: () => setAdding(false) }); }}><label>Reference<Input name="reference" required/></label><label>Business unit<select name="unit" required className="block w-full rounded border p-3">{units.data?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Patient name<Input name="patient" required/></label><label>Pickup<Input name="pickup" required/></label><label>Drop-off<Input name="dropoff" required/></label><label>Pickup time<Input name="time" type="datetime-local" required/></label><Button type="submit" disabled={createMut.isPending}>Create request</Button></form></CardContent></Card>}
      <Card>
        <CardHeader>
          <CardTitle>Trip Requests</CardTitle>
          <CardDescription>Manage transport workflow status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-b border-border">
              <thead>
                <tr className="text-navy-900 font-medium">
                  <th className="p-3 text-left">Reference</th>
                  <th className="p-3 text-left">Patient</th>
                  <th className="p-3 text-left">Pickup</th>
                  <th className="p-3 text-left">Dropoff</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Driver</th>
                  <th className="p-3 text-left">Vehicle</th>
                  <th className="p-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-xs">{r.reference}</td>
                    <td className="p-3">{r.patient}</td>
                    <td className="p-3 text-xs">{r.pickup}</td>
                    <td className="p-3 text-xs">{r.dropoff}</td>
                    <td className="p-3">
                      <Badge variant={r.status === "completed" ? "success" : r.status === "pending" ? "default" : "outline"}>
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs">{r.driver}</td>
                    <td className="p-3 text-xs">{r.vehicle}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {!r.trip && r.status === "pending" && <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); assign.mutate({ request: r.id, driver: Number(fd.get("driver")), vehicle: Number(fd.get("vehicle")) }); }}><select name="driver" required aria-label="Assign driver"><option value="">Driver</option>{drivers.data?.filter(d => d.is_available).map(d => <option key={d.id} value={d.id}>{d.user_name}</option>)}</select><select name="vehicle" required aria-label="Assign vehicle"><option value="">Vehicle</option>{vehicles.data?.filter(v => v.status === "available").map(v => <option key={v.id} value={v.id}>{v.license_plate}</option>)}</select><Button type="submit" disabled={assign.isPending}>Assign</Button></form>}

                        {STATUS_ORDER.filter((s, i) => r.trip && i === STATUS_ORDER.findIndex(x => x.key === r.status) + 1).map((s) => (
                          <Button
                            key={s.key}
                            size="sm"
                            onClick={() => transitionMut.mutate({ id: r.trip.id, status: s.key })}
                            disabled={r.status === s.key || transitionMut.isPending}
                            variant={r.status === s.key ? "default" : "outline"}
                          >
                            {s.label}
                          </Button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={8} className="p-4 text-center text-slate-400 text-xs">{isLoading ? "Loading requests…" : "No trip requests."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
