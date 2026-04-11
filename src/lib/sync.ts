import {
  getPendingSyncItems,
  updateSyncItem,
  removeSyncItem,
  cacheJobs,
  cacheSuppliers,
  cacheEstimators,
  cacheTemplates,
  cacheSettings,
} from "./offline-store";
import { readJsonFile, writeJsonFile, listFolder } from "./onedrive";
import type { Job, Supplier, Estimator, EmailTemplate, AppSettings } from "@/types";

const MAX_RETRIES = 3;

/**
 * Sync pending offline writes to OneDrive.
 * Last-write-wins: the most recent timestamp overwrites.
 * Returns the number of successfully synced items.
 */
export async function syncPendingWrites(accessToken: string, rootPath: string): Promise<number> {
  const pending = await getPendingSyncItems();
  if (pending.length === 0) return 0;

  let synced = 0;

  for (const item of pending) {
    try {
      await updateSyncItem(item.id, { status: "syncing" });

      switch (item.type) {
        case "job": {
          const job = item.data as Job;
          const jobFolder = `${rootPath}/${job.jobCode} - ${job.address}`;
          // Last-write-wins: read current, check timestamp
          const existing = await readJsonFile<Job>(accessToken, `${jobFolder}/job-config.json`);
          if (existing && new Date(existing.updatedAt).getTime() > item.timestamp) {
            // Server version is newer — log conflict
            const conflict = {
              timestamp: new Date(item.timestamp).toISOString(),
              overwrittenBy: "server",
              previousData: item.data,
            };
            const conflicts = existing.conflicts || [];
            conflicts.push(conflict);
            await writeJsonFile(accessToken, `${jobFolder}/job-config.json`, {
              ...existing,
              conflicts,
            });
          } else {
            await writeJsonFile(accessToken, `${jobFolder}/job-config.json`, {
              ...job,
              updatedAt: new Date(item.timestamp).toISOString(),
            });
          }
          break;
        }
        case "supplier": {
          const suppliers = item.data as Supplier[];
          await writeJsonFile(accessToken, `${rootPath}/suppliers.json`, suppliers);
          break;
        }
        case "estimator": {
          const estimators = item.data as Estimator[];
          await writeJsonFile(accessToken, `${rootPath}/estimators.json`, estimators);
          break;
        }
        case "template": {
          const templates = item.data as EmailTemplate[];
          await writeJsonFile(accessToken, `${rootPath}/templates.json`, templates);
          break;
        }
        case "settings": {
          const settings = item.data as AppSettings;
          await writeJsonFile(accessToken, `${rootPath}/settings.json`, settings);
          break;
        }
      }

      await removeSyncItem(item.id);
      synced++;
    } catch (error) {
      console.error(`Sync failed for ${item.id}:`, error);
      const newRetry = item.retryCount + 1;
      if (newRetry >= MAX_RETRIES) {
        await updateSyncItem(item.id, { status: "failed", retryCount: newRetry });
      } else {
        await updateSyncItem(item.id, { status: "pending", retryCount: newRetry });
      }
    }
  }

  return synced;
}

/**
 * Pull fresh data from OneDrive and update the IndexedDB cache.
 * Used on app load and when coming back online.
 */
export async function pullFromOneDrive(accessToken: string, rootPath: string): Promise<void> {
  try {
    // Pull settings
    const settings = await readJsonFile<AppSettings>(accessToken, `${rootPath}/settings.json`);
    if (settings) await cacheSettings(settings);

    // Pull suppliers
    const suppliers = await readJsonFile<Supplier[]>(accessToken, `${rootPath}/suppliers.json`);
    if (suppliers) await cacheSuppliers(suppliers);

    // Pull estimators
    const estimators = await readJsonFile<Estimator[]>(accessToken, `${rootPath}/estimators.json`);
    if (estimators) await cacheEstimators(estimators);

    // Pull templates
    const templates = await readJsonFile<EmailTemplate[]>(accessToken, `${rootPath}/templates.json`);
    if (templates) await cacheTemplates(templates);

    // Pull jobs
    const items = await listFolder(accessToken, rootPath);
    const jobFolders = items.filter(
      (item) => item.folder && !item.name.endsWith(".json")
    );
    const jobs: Job[] = [];
    for (const folder of jobFolders) {
      try {
        const job = await readJsonFile<Job>(accessToken, `${rootPath}/${folder.name}/job-config.json`);
        if (job) jobs.push(job);
      } catch {
        // Skip folders without valid job-config.json
      }
    }
    if (jobs.length > 0) await cacheJobs(jobs);
  } catch (error: unknown) {
    const graphErr = error as { statusCode?: number; message?: string; code?: string };
    console.error("Pull from OneDrive failed:", {
      statusCode: graphErr.statusCode,
      code: graphErr.code,
      message: graphErr.message,
      error,
    });
  }
}

/**
 * Check if the browser is online.
 */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/**
 * Register online/offline event listeners.
 * Returns a cleanup function.
 */
export function onConnectivityChange(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}
