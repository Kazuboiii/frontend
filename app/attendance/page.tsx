"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, listAll } from "@/lib/api";
import { getUserFromStorage, hasRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, User as UserIcon, Filter } from "lucide-react";

const ACTION: { key: "check_in" | "check_out"; label: string; icon: any }[] = [
  { key: "check_in", label: "Check In", icon: Activity },
  { key: "check_out", label: "Check Out", icon: Clock },
];

export default function AttendancePage() {
  const user = getUserFromStorage();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<"check_in" | "check_out">("check_in");

  const { data, isLoading } = useQuery({
    queryKey: ["attendance-events"],
    queryFn: async () => {
      return listAll("/attendance/events/");
    },
    enabled: !!user,
  });

  const rows = (data || []).map((e: any) => ({
    id: e.id,
    employee: e.employee_name || e.employee_id,
    unit: e.business_unit_name,
    action: e.action.replace("_", " "),
    time: formatDateTime(e.timestamp),
    source: e.source,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-2xl font-bold text-navy-900">Attendance</CardTitle>
          <CardDescription>Record and view check-in / check-out events.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="mr-2" />
          <Button
            onClick={() => { window.location.href = `/qr-attendance?action=${action}`; }}
            variant="teal"
            className="flex items-center gap-2"
          >
            {(() => {
              const cfg = ACTION.find((x) => x.key === action);
              return cfg ? <cfg.icon size={16} /> : null;
            })()}
            {action.replace("_", " ")} Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ACTION.map((a: any) => (
          <Card key={a.key} onClick={() => setAction(a.key)} className="cursor-pointer hover:bg-teal-50 transition">
            <CardContent className="p-4">
              <a.icon className="h-5 w-5 mb-2 text-teal-600" />
              <div className="text-sm font-medium text-navy-900">{a.label}</div>
              <div className="text-xs text-slate-500">Record {a.label.toLowerCase()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Server-authoritative attendance records.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "employee", label: "Employee" },
              { key: "unit", label: "Unit" },
              { key: "action", label: "Action" },
              { key: "time", label: "Time" },
              { key: "source", label: "Source" },
            ]}
            data={rows}
            loading={isLoading}
            emptyMessage="No attendance records yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
