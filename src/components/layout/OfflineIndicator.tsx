"use client";

import { useState, useEffect } from "react";
import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { isOnline, onConnectivityChange } from "@/lib/sync";
import { getSyncQueueCount } from "@/lib/offline-store";

export default function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  useEffect(() => {
    setOnline(isOnline());

    const cleanup = onConnectivityChange(
      () => setOnline(true),
      () => setOnline(false)
    );

    // Check sync queue periodically
    const interval = setInterval(async () => {
      const count = await getSyncQueueCount();
      setPendingSyncs(count);
    }, 5000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  if (online && pendingSyncs === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {!online && (
        <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg shadow-lg border border-amber-200 text-sm font-medium">
          <WifiOff className="w-4 h-4" />
          <span>Offline — changes saved locally</span>
        </div>
      )}
      {pendingSyncs > 0 && online && (
        <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-lg border border-blue-200 text-sm font-medium">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing {pendingSyncs} change{pendingSyncs > 1 ? "s" : ""}...</span>
        </div>
      )}
      {pendingSyncs > 0 && !online && (
        <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg shadow-lg border border-gray-200 text-sm font-medium">
          <CloudOff className="w-4 h-4" />
          <span>{pendingSyncs} pending sync{pendingSyncs > 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
