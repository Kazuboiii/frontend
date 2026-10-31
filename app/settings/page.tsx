"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, listAll } from "@/lib/api";
import { getUserFromStorage, hasRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, Building2, User as UserIcon } from "lucide-react";

export default function SettingsPage() {
  const user = getUserFromStorage();
  const queryClient = useQueryClient();
  const canAdmin = hasRole("super_admin");

  const { data: users, isLoading } = useQuery({
    queryKey: ["settings-users"],
    queryFn: async () => {
      return listAll("/users/");
    },
    enabled: !!user && canAdmin,
  });

  const rows = (users || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.first_name || u.last_name || u.email,
    role: u.role_name || u.role_code,
    unit: u.business_unit_name || "—",
    active: u.is_active,
  }));

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const r = await api.patch(`/users/${id}/`, { is_active: active });
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-users"] });
    },
  });

  if (!canAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <CardTitle className="text-navy-900">Access Restricted</CardTitle>
          <CardDescription>Super Administrator access required.</CardDescription>
        </CardContent>
      </Card>
    );
  }


  return (
    <div className="space-y-6">
      <div>
        <CardTitle className="text-2xl font-bold text-navy-900">Settings &amp; Access Control</CardTitle>
        <CardDescription>Manage users, roles, and permissions.</CardDescription>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Platform accounts and account status.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: "email", label: "Email" },
              { key: "name", label: "Name" },
              { key: "role", label: "Role" },
              { key: "unit", label: "Business Unit" },
              {
                key: "active",
                label: "Status",
                render: (u: any) => (
                  <Badge variant={u.active ? "success" : "destructive"}>
                    {u.active ? "Active" : "Disabled"}
                  </Badge>
                ),
              },
              {
                key: "id",
                label: "Action",
                render: (u: any) => (
                  <Button
                    size="sm"
                    onClick={() => toggleMut.mutate({ id: u.id, active: !u.active })}
                    disabled={toggleMut.isPending || u.id === user?.id}
                    variant="outline"
                  >
                    {toggleMut.isPending ? "…" : (u.active ? "Disable" : "Enable")}
                  </Button>
                ),
              },
            ]}
            data={rows}
            loading={isLoading}
            emptyMessage="No users."
          />
        </CardContent>
      </Card>
    </div>
  );
}
