"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { onConnectivityChange, isOnline } from "@/lib/sync";
import {
  cacheJobs,
  cacheSuppliers,
  cacheEstimators,
  cacheTemplates,
  cacheSettings,
  getPendingSyncItems,
  updateSyncItem,
  removeSyncItem,
} from "@/lib/offline-store";
import {
  getJobs,
  getSuppliers,
  getEstimators,
  getTemplates,
  getSettings,
  saveJob,
  saveSupplier,
  saveEstimator,
  saveTemplate,
  saveSettings,
} from "@/lib/supabase";
import type { Job, Supplier, Estimator, EmailTemplate, AppSettings } from "@/types";

const CACHE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;

export default function SyncManager() {
  const { status } = useSession();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cache all Supabase data to IndexedDB
  async function cacheAllData() {
    try {
      const [jobs, suppliers, estimators, templates, settings] = await Promise.all([
        getJobs(),
        getSuppliers(),
        getEstimators(),
        getTemplates(),
        getSettings(),
      ]);
      await Promise.all([
        cacheJobs(jobs),
        cacheSuppliers(suppliers),
        cacheEstimators(estimators),
        cacheTemplates(templates),
        cacheSettings(settings),
      ]);
    } catch (err) {
      console.error("[SyncManager] Cache failed:", err);
    }
  }

  // Push pending offline writes to Supabase
  async function processSyncQueue() {
    const pending = await getPendingSyncItems();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        await updateSyncItem(item.id, { status: "syncing" });

        switch (item.type) {
          case "job":
            await saveJob(item.data as Job);
            break;
          case "supplier":
            await saveSupplier(item.data as Supplier);
            break;
          case "estimator":
            await saveEstimator(item.data as Estimator);
            break;
          case "template":
            await saveTemplate(item.data as EmailTemplate);
            break;
          case "settings":
            await saveSettings(item.data as AppSettings);
            break;
        }

        await removeSyncItem(item.id);
      } catch (err) {
        console.error(`[SyncManager] Sync failed for ${item.id}:`, err);
        const newRetry = item.retryCount + 1;
        await updateSyncItem(item.id, {
          status: newRetry >= MAX_RETRIES ? "failed" : "pending",
          retryCount: newRetry,
        });
      }
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return;

    // Initial cache
    cacheAllData();

    // Periodic cache refresh
    intervalRef.current = setInterval(() => {
      if (isOnline()) cacheAllData();
    }, CACHE_INTERVAL);

    // On reconnect: push pending writes then refresh cache
    const cleanup = onConnectivityChange(
      async () => {
        await processSyncQueue();
        await cacheAllData();
      },
      () => {} // offline — do nothing, writes go to IndexedDB via offline-store
    );

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      cleanup();
    };
  }, [status]);

  return null; // Invisible — just runs sync logic
}
