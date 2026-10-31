"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, listAll } from "@/lib/api";
import { getUserFromStorage } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { Play, Pause, RefreshCw } from "lucide-react";

const MapView = dynamic(() => import("@/components/map-view"), { ssr: false });

export default function GPSPage() {
  const user = getUserFromStorage();
  const queryClient = useQueryClient();
  const [simRunning, setSimRunning] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: vehicles, isLoading: vLoading } = useQuery({
    queryKey: ["gps-vehicles"],
    queryFn: async () => {
      return listAll("/fleet/vehicles/");
    },
    enabled: !!user,
  });

  const { data: positions, isLoading: pLoading } = useQuery({
    queryKey: ["gps-positions"],
    queryFn: async () => {
      return listAll("/fleet/gps-positions/");
    },
    enabled: !!user,
    refetchInterval: simRunning ? 3000 : 0,
  });

  const postPosMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await api.post("/fleet/gps-positions/", payload);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gps-positions"] });
    },
  });

  const { mutate: postPosition } = postPosMut;

  const BASE_LAT = 27.7172;
  const BASE_LNG = 85.3240;

  useEffect(() => {
    if (!simRunning) return;
    let idx = 0;
    const veh = vehicles?.[0];
    if (!veh) return;
    simRef.current = setInterval(() => {
      const lat = BASE_LAT + (idx % 6) * 0.0015 + (Math.random() - 0.5) * 0.0005;
      const lng = BASE_LNG + (idx % 6) * 0.0012 + (Math.random() - 0.5) * 0.0005;
      idx++;
      postPosition({ vehicle: veh.id, latitude: lat, longitude: lng, simulated: true, speed: 20 + Math.random() * 20 });
    }, 3000);
    return () => {
      if (simRef.current) clearInterval(simRef.current);
      simRef.current = null;
    };
  }, [simRunning, vehicles, postPosition]);

  const posList = positions || [];
  const latestByVehicle: Record<number, any> = {};
  posList.forEach((p: any) => {
    if (!latestByVehicle[p.vehicle] || new Date(p.recorded_at) > new Date(latestByVehicle[p.vehicle].recorded_at)) {
      latestByVehicle[p.vehicle] = p;
    }
  });

  const connectedCount = Object.values(latestByVehicle).filter((p: any) => p.simulated).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-2xl font-bold text-navy-900">Fleet GPS Simulator</CardTitle>
          <CardDescription>Simulated vehicle telemetry stored to the backend.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setSimRunning(!simRunning)} variant={simRunning ? "destructive" : "teal"} disabled={!vehicles?.length}>
            {simRunning ? <Pause size={16} className="mr-2" /> : <Play size={16} className="mr-2" />}
            {simRunning ? "Pause Simulation" : "Start Simulation"}
          </Button>
          <Button onClick={() => postPosMut.mutate({ vehicle: vehicles?.[0]?.id, latitude: BASE_LAT, longitude: BASE_LNG, simulated: true, speed: 0 })} size="sm" variant="outline" disabled={!vehicles?.length || postPosMut.isPending}>
            <RefreshCw size={16} className="mr-2" /> Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-[500px]">
            <CardContent className="p-0 h-full">
              <MapView vehicles={vehicles || []} positions={posList} selectedVehicle={selectedVehicle} onSelect={setSelectedVehicle} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedVehicle ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Plate</span><span className="text-navy-900 font-medium">{selectedVehicle.license_plate}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Make/Model</span><span className="text-navy-900">{selectedVehicle.make} {selectedVehicle.model}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Capacity</span><span className="text-navy-900">{selectedVehicle.capacity}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Status</span><Badge variant={selectedVehicle.status === "available" ? "success" : "muted"}>{selectedVehicle.status}</Badge></div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Select a vehicle on the map.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Simulation Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Simulation</span><Badge variant={simRunning ? "success" : "muted"}>{simRunning ? "Running" : "Stopped"}</Badge></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Vehicles sending telemetry</span><span className="text-navy-900 font-medium">{connectedCount}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Data</span><span className="text-navy-900 font-medium">Simulated (no GPS hardware)</span></div>
              <p className="text-xs text-slate-500">Positions are POSTed to the backend and stored in the database.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
