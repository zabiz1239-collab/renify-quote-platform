"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  getCachedJobs,
  getCachedSuppliers,
  getCachedEstimators,
  getCachedTemplates,
  getCachedSettings,
  cacheJobs,
  getSyncQueueCount,
} from "@/lib/offline-store";
import { syncPendingWrites, pullFromOneDrive, isOnline, onConnectivityChange } from "@/lib/sync";
import { readJsonFile, listFolder } from "@/lib/onedrive";
import type { Job, Supplier, Estimator, EmailTemplate, AppSettings } from "@/types";
import { DEFAULT_ONEDRIVE_ROOT } from "@/types";

interface OfflineDataState {
  jobs: Job[];
  suppliers: Supplier[];
  estimators: Estimator[];
  templates: EmailTemplate[];
  settings: AppSettings | null;
  loading: boolean;
  online: boolean;
  pendingSyncs: number;
  lastSynced: Date | null;
  refresh: () => Promise<void>;
}

export function useOfflineData(): OfflineDataState {
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [estimators, setEstimators] = useState<Estimator[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const syncingRef = useRef(false);

  const accessToken = session?.accessToken;

  // Load cached data first (instant), then pull from OneDrive
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Step 1: Load from IndexedDB (instant)
      const [cachedJobs, cachedSuppliers, cachedEstimators, cachedTemplates, cachedSettings] =
        await Promise.all([
          getCachedJobs(),
          getCachedSuppliers(),
          getCachedEstimators(),
          getCachedTemplates(),
          getCachedSettings(),
        ]);

      if (cachedJobs.length > 0) setJobs(cachedJobs);
      if (cachedSuppliers.length > 0) setSuppliers(cachedSuppliers);
      if (cachedEstimators.length > 0) setEstimators(cachedEstimators);
      if (cachedTemplates.length > 0) setTemplates(cachedTemplates);
      if (cachedSettings) setSettings(cachedSettings);

      // Step 2: If online and authenticated, pull fresh from OneDrive
      if (isOnline() && accessToken) {
        const rp = cachedSettings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;

        // Sync pending writes first
        if (!syncingRef.current) {
          syncingRef.current = true;
          await syncPendingWrites(accessToken, rp);
          syncingRef.current = false;
        }

        // Pull fresh data
        await pullFromOneDrive(accessToken, rp);

        // Reload from cache after pull
        const [freshJobs, freshSuppliers, freshEstimators, freshTemplates, freshSettings] =
          await Promise.all([
            getCachedJobs(),
            getCachedSuppliers(),
            getCachedEstimators(),
            getCachedTemplates(),
            getCachedSettings(),
          ]);

        setJobs(freshJobs);
        setSuppliers(freshSuppliers);
        setEstimators(freshEstimators);
        setTemplates(freshTemplates);
        if (freshSettings) setSettings(freshSettings);
        setLastSynced(new Date());
      }

      const count = await getSyncQueueCount();
      setPendingSyncs(count);
    } catch (error) {
      console.error("Failed to load offline data:", error);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Refresh function (callable from pull-to-refresh, etc.)
  const refresh = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Online/offline listeners
  useEffect(() => {
    setOnline(isOnline());

    const cleanup = onConnectivityChange(
      () => {
        setOnline(true);
        // Auto-sync when coming back online
        loadData();
      },
      () => {
        setOnline(false);
      }
    );

    return cleanup;
  }, [loadData]);

  return {
    jobs,
    suppliers,
    estimators,
    templates,
    settings,
    loading,
    online,
    pendingSyncs,
    lastSynced,
    refresh,
  };
}

/**
 * Hook for loading jobs with offline-first strategy.
 * Simpler version for pages that only need jobs.
 */
export function useOfflineJobs() {
  const { data: session } = useSession();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cache first
      const cached = await getCachedJobs();
      if (cached.length > 0) setJobs(cached);

      // Then pull from OneDrive if online
      if (isOnline() && session?.accessToken) {
        const settings = await readJsonFile<AppSettings>(
          session.accessToken,
          `${DEFAULT_ONEDRIVE_ROOT}/settings.json`
        );
        const rootPath = settings?.oneDriveRootPath || DEFAULT_ONEDRIVE_ROOT;
        const items = await listFolder(session.accessToken, rootPath);
        const jobFolders = items.filter(
          (item) => item.folder && !item.name.endsWith(".json")
        );

        const freshJobs: Job[] = [];
        for (const folder of jobFolders) {
          try {
            const job = await readJsonFile<Job>(
              session.accessToken,
              `${rootPath}/${folder.name}/job-config.json`
            );
            if (job) freshJobs.push(job);
          } catch {
            // skip
          }
        }

        if (freshJobs.length > 0) {
          setJobs(freshJobs);
          await cacheJobs(freshJobs);
        }
      }
    } catch (err) {
      console.error("Failed to load jobs:", err);
      setError("Failed to load jobs. Using cached data.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return { jobs, loading, error, refresh: loadJobs };
}
