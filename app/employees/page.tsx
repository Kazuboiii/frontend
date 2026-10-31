"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, listAll } from "@/lib/api";
import { getUserFromStorage } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, User as UserIcon } from "lucide-react";

export default function EmployeesPage() {
  const user = getUserFromStorage();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const users = useQuery({ queryKey: ["employee-users"], queryFn: () => listAll("/users/") });
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      return listAll("/employees/");
    },
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: async (payload: any) => {
      const r = await api.post("/employees/", payload);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setAdding(false);
    },
  });

  const rows = (data || []).filter((e: any) =>
    !q || e.employee_id.toLowerCase().includes(q.toLowerCase()) ||
    (e.user_name || "").toLowerCase().includes(q.toLowerCase()) ||
    (e.designation || "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-2xl font-bold text-navy-900">Employees</CardTitle>
          <CardDescription>Manage employee records across business units.</CardDescription>
        </div>
        <div className="flex items-end gap-2">
          <Button
            onClick={() => setAdding(!adding)}
            disabled={!user}
            variant="teal"
          >
            <Plus size={16} className="mr-2" /> Add Employee
          </Button>
        </div>
      </div>

      {adding && <Card><CardContent className="p-4"><form className="grid gap-4 sm:grid-cols-2" onSubmit={e => {
        e.preventDefault(); const fd = new FormData(e.currentTarget); const account = users.data?.find(u => u.id === Number(fd.get("user")));
        if (account) createMut.mutate({ user: account.id, business_unit: account.business_unit, employee_id: fd.get("employee_id"), designation: fd.get("designation") });
      }}><label>Account<select name="user" required className="block w-full rounded border p-3"><option value="">Choose an account</option>{users.data?.filter(u => u.business_unit && !data?.some(e => e.user === u.id)).map(u => <option key={u.id} value={u.id}>{u.email} — {u.business_unit_name}</option>)}</select></label><label>Employee ID<Input name="employee_id" required/></label><label>Designation<Input name="designation" required/></label><Button type="submit" disabled={createMut.isPending}>Save employee</Button></form></CardContent></Card>}

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search employees…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <DataTable
            columns={[
              { key: "employee_id", label: "Employee ID" },
              { key: "user_name", label: "Name" },
              { key: "business_unit_name", label: "Business Unit" },
              { key: "department_name", label: "Department" },
              { key: "designation", label: "Designation" },
              {
                key: "is_active",
                label: "Status",
                render: (e: any) => (
                  <Badge variant={e.is_active ? "success" : "muted"}>
                    {e.is_active ? "Active" : "Inactive"}
                  </Badge>
                ),
              },
            ]}
            data={rows}
            loading={isLoading}
            emptyMessage="No employees found."
          />
        </CardContent>
      </Card>
    </div>
  );
}
