"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import OfflineIndicator from "./OfflineIndicator";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#2D5E3A] mx-auto mb-4">
            <span className="text-lg font-bold text-white">R</span>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <MobileNav />
        <div className="hidden md:flex items-center justify-end px-6 py-3 border-b">
          <Link
            href="/settings"
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
        </div>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-white focus:text-[#2D5E3A] focus:font-medium">
          Skip to content
        </a>
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-8 bg-muted/30">
          {children}
        </main>
      </div>
      <OfflineIndicator />
    </div>
  );
}
