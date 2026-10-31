"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<T> {
  columns: { key: string; label: string; render?: (item: T) => React.ReactNode }[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends { id?: number | string }>({
  columns,
  data,
  loading = false,
  emptyMessage = "No records found.",
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-background p-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 mb-3 rounded bg-muted" />
        ))}
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <div className="rounded-lg border border-border bg-background p-8 text-center text-slate-500 text-sm">{emptyMessage}</div>;
  }
  return (
    <div className={cn("rounded-lg border border-border bg-background", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {col.render ? col.render(item) : String((item as any)[col.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
