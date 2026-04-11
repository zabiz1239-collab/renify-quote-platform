"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Truck,
  Settings,
  LogOut,
  Kanban,
  FileText,
  BarChart3,
  Activity,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/quotes", label: "Quote Board", icon: Kanban },
  { href: "/compare", label: "Compare", icon: BarChart3 },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/estimators", label: "Estimators", icon: Users },
  { href: "/estimators/workload", label: "Workload", icon: Activity },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/setup", label: "Setup Guide", icon: Rocket },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 bg-gray-900 text-white h-screen overflow-y-auto">
      <div className="p-6 border-b border-gray-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#2D5E3A]">
            <span className="text-lg font-bold text-white">R</span>
          </div>
          <span className="text-xl font-semibold">Renify</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          // Find the most specific matching nav item to avoid double-highlights
          const bestMatch = navItems
            .filter((n) => pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href + "/")))
            .sort((a, b) => b.href.length - a.href.length)[0];
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : bestMatch?.href === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                isActive
                  ? "bg-[#2D5E3A] text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full min-h-[44px]"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
