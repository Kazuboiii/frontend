"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  Shield,
  User,
  ClipboardList,
  BarChart3,
  QrCode,
  Truck,
  DollarSign,
  Settings,
  LogOut,
  Globe,
  Send,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { clearTokens, clearUser, getUserFromStorage } from "@/lib/auth";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  badge?: boolean;
}

const ALL_ROLES = ["super_admin","healthcare_admin","resort_admin","hr_manager","fleet_manager","healthcare_inventory_manager","resort_inventory_manager","inventory_manager","accountant","driver","employee"];

const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { title: "Employees", href: "/employees", icon: Users, roles: ["super_admin","healthcare_admin","resort_admin","hr_manager","fleet_manager","healthcare_inventory_manager","resort_inventory_manager","inventory_manager"] },
  { title: "Attendance", href: "/attendance", icon: ClipboardList, roles: ["super_admin","healthcare_admin","resort_admin","hr_manager","driver","employee"] },
  { title: "QR Attendance", href: "/qr-attendance", icon: QrCode, roles: ["super_admin","healthcare_admin","resort_admin","hr_manager","driver","employee"], badge: true },
  { title: "Fleet", href: "/fleet", icon: Truck, roles: ["super_admin","healthcare_admin","resort_admin","fleet_manager","driver"] },
  { title: "NEMT Trips", href: "/nemt", icon: Smartphone, roles: ["super_admin","healthcare_admin","hr_manager","fleet_manager","driver"] },
  { title: "Medicine Delivery", href: "/medicine-delivery", icon: Send, roles: ["super_admin","healthcare_admin","healthcare_inventory_manager","inventory_manager","driver"] },
  { title: "Inventory", href: "/inventory", icon: Shield, roles: ["super_admin","healthcare_admin","resort_admin","healthcare_inventory_manager","resort_inventory_manager","inventory_manager","hr_manager","accountant"] },
  { title: "Payroll", href: "/payroll", icon: DollarSign, roles: ["super_admin","hr_manager"] },
  { title: "GPS Simulator", href: "/gps", icon: Globe, roles: ["super_admin","healthcare_admin","resort_admin","fleet_manager"] },
  { title: "Reports", href: "/reports", icon: BarChart3, roles: ["super_admin","healthcare_admin","resort_admin","hr_manager","healthcare_inventory_manager","resort_inventory_manager","inventory_manager","fleet_manager","accountant"] },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["super_admin"] },
];

export function Sidebar({ open = false, onNavigate }: { open?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = getUserFromStorage();
  const role = user?.role_code;

  const items = useMemo(
    () => NAV_ITEMS.filter((i) => !role || i.roles.includes(role)),
    [role],
  );

  const handleLogout = async () => {
    const refresh = localStorage.getItem("refresh_token");
    clearTokens();
    clearUser();
    localStorage.removeItem("selected_division");
    try {
      if (refresh) await api.post("/auth/logout/", { refresh });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-navy-900 text-white flex flex-col lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center justify-between h-16 px-6 border-b border-navy-800 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-teal-600 flex items-center justify-center">
            <Globe size={20} />
          </div>
          <span className="font-bold text-lg tracking-tight">UEMS</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sign out" className="h-11 px-2">
          <LogOut size={16} />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {user && (
          <div className="px-4 pb-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-teal-400">
                <User size={20} />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{user.first_name || user.email}</p>
                <p className="text-xs text-navy-300 truncate">{user.role_name}</p>
              </div>
            </div>
            <div className="h-px bg-navy-800 my-2" />
          </div>
        )}
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "bg-teal-600 text-white shadow"
                  : "text-navy-200 hover:bg-navy-800 hover:text-white",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.title}
              {item.badge && (
                <span className="ml-auto h-5 rounded-full bg-teal-600/20 px-2 py-0.5 text-xs text-teal-300">NEW</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-navy-800">
        <Button variant="outline" className="w-full text-sm" onClick={handleLogout}>
          <LogOut size={16} className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
