import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import ServiceWorkerRegistrar from "@/components/providers/ServiceWorkerRegistrar";
import SyncManager from "@/components/providers/SyncManager";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "Renify Quote Platform",
    template: "%s — Renify Quote Platform",
  },
  description: "Construction supplier quote management with OneDrive integration",
  manifest: "/manifest.json",
  openGraph: {
    title: "Renify Quote Platform",
    description: "Construction supplier quote management with OneDrive integration",
    type: "website",
    siteName: "Renify",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Renify",
  },
};

export const viewport: Viewport = {
  themeColor: "#2D5E3A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider>
          <SyncManager />
          {children}
        </SessionProvider>
        <Toaster position="top-right" richColors closeButton duration={4000} visibleToasts={3} />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
