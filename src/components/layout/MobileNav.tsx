"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Briefcase,
  Truck,
  Settings,
  LogOut,
  Menu,
  X,
  Mail,
  FileInput,
  BarChart3,
  FileText,
  Users,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/kanban", label: "Quote Board", icon: Columns3 },
  { href: "/quotes/intake", label: "Receive Quote", icon: FileInput },
  { href: "/quotes", label: "Send Quotes", icon: Mail },
  { href: "/compare", label: "Compare", icon: BarChart3 },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/estimators", label: "Estimators", icon: Users },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2D5E3A]">
            <span className="text-sm font-bold text-white">R</span>
          </div>
          <span className="text-lg font-semibold">Renify</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Slide-down menu */}
      {open && (
        <nav className="bg-gray-900 text-white border-t border-gray-800 p-4 space-y-1">
          {navItems.map((item) => {
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
                onClick={() => setOpen(false)}
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
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full min-h-[44px]"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Sign Out
          </button>
        </nav>
      )}
    </div>
  );
}
