"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { divIcon } from "leaflet";
import { Wifi } from "lucide-react";

interface MapViewProps {
  vehicles: any[];
  positions: any[];
  selectedVehicle: any | null;
  onSelect: (vehicle: any) => void;
}

const BASE_LAT = 27.7172;
const BASE_LNG = 85.3240;

export default function MapView({ vehicles, positions, selectedVehicle, onSelect }: MapViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const latestByVehicle: Record<number, any> = {};
  positions.forEach((p: any) => {
    if (!latestByVehicle[p.vehicle] || new Date(p.recorded_at) > new Date(latestByVehicle[p.vehicle].recorded_at)) {
      latestByVehicle[p.vehicle] = p;
    }
  });

  if (!mounted) {
    return <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">Loading map…</div>;
  }

  return (
    <div className="h-full w-full rounded-lg border border-border overflow-hidden">
      <MapContainer
        center={[BASE_LAT, BASE_LNG]}
        zoom={14}
        className="h-full w-full"
        style={{ height: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {vehicles.map((v: any) => {
          const p = latestByVehicle[v.id];
          const pos: [number, number] = p ? [p.latitude, p.longitude] : [BASE_LAT, BASE_LNG];
          return (
            <Marker key={v.id} position={pos} icon={divIcon({ html: "<span style='display:block;width:20px;height:20px;border-radius:50%;background:#0d9488;border:3px solid white'></span>", className: "", iconSize: [20,20] })} eventHandlers={{ click: () => onSelect(v) }}>
              <Popup>
                <div className="min-w-[160px]">
                  <div className="font-semibold text-navy-900">{v.license_plate}</div>
                  <div className="text-xs text-slate-500">{v.make} {v.model}</div>
                  {p && (
                    <div className="text-xs text-slate-500 mt-1">
                      Simulated • {new Date(p.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  <div className="text-xs mt-1 font-medium">
                    {p && p.simulated ? (
                      <span className="text-teal-600"><Wifi size={14} className="mr-1" /> SIMULATED</span>
                    ) : (
                      <span className="text-red-600">DISCONNECTED</span>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        {selectedVehicle && (
          <Polyline positions={positions.filter(p => p.vehicle === selectedVehicle.id).sort((a,b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()).map(p => [Number(p.latitude), Number(p.longitude)] as [number,number])} color="#0d9488" />
        )}
      </MapContainer>
    </div>
  );
}
