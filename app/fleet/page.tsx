"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, listAll } from "@/lib/api";
import { getUserFromStorage } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Truck, User as UserIcon, MapPin, Battery } from "lucide-react";

export default function FleetPage() {
  const user = getUserFromStorage();
  const queryClient = useQueryClient();

  const { data: vehicles, isLoading: vLoading } = useQuery({
    queryKey: ["fleet-vehicles"],
    queryFn: async () => {
      return listAll("/fleet/vehicles/");
    },
    enabled: !!user,
  });

  const { data: drivers } = useQuery({
    queryKey: ["fleet-drivers"],
    queryFn: async () => {
      return listAll("/fleet/drivers/");
    },
    enabled: !!user,
  });

  const assignMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await api.post("/fleet/assignments/", payload);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["fleet-drivers"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <CardTitle className="text-2xl font-bold text-navy-900">Fleet Management</CardTitle>
        <CardDescription>Vehicles, drivers, and assignments.</CardDescription>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vehicles</CardTitle>
            <CardDescription>Fleet status and availability.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "license_plate", label: "Plate" },
                { key: "make", label: "Make" },
                { key: "model", label: "Model" },
                { key: "capacity", label: "Capacity" },
                {
                  key: "status",
                  label: "Status",
                  render: (v: any) => (
                    <Badge variant={v.status === "available" ? "success" : v.status === "maintenance" ? "muted" : "default"}>
                      {v.status}
                    </Badge>
                  ),
                },
              ]}
              data={vehicles || []}
              loading={vLoading}
              emptyMessage="No vehicles."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drivers</CardTitle>
            <CardDescription>Driver profiles and availability.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: "user_name", label: "Driver" },
                { key: "license_number", label: "License" },
                { key: "phone", label: "Phone" },
                {
                  key: "is_available",
                  label: "Available",
                  render: (d: any) => (
                    <Badge variant={d.is_available ? "success" : "muted"}>
                      {d.is_available ? "Yes" : "No"}
                    </Badge>
                  ),
                },
              ]}
              data={drivers || []}
              emptyMessage="No drivers."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assign Vehicle</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              assignMut.mutate({
                vehicle: Number(fd.get("vehicle")),
                driver: Number(fd.get("driver")),
              });
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
          >
            <div>
              <label className="text-xs text-slate-500 block mb-1">Vehicle</label>
              <select name="vehicle" required className="w-full border border-input rounded-md px-3 py-2 bg-background">
                {(vehicles || []).filter((v: any) => v.status === "available").map((v: any) => (
                  <option key={v.id} value={v.id}>{v.license_plate}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Driver</label>
              <select name="driver" required className="w-full border border-input rounded-md px-3 py-2 bg-background">
                {(drivers || []).filter((d: any) => d.is_available).map((d: any) => (
                  <option key={d.id} value={d.id}>{d.user_name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={assignMut.isPending || !vehicles?.some(v => v.status === "available") || !drivers?.some(d => d.is_available)} variant="teal">
              {assignMut.isPending ? "Assigning…" : "Assign"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
