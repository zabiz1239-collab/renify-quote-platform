/* eslint-disable @typescript-eslint/no-unused-vars */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Job, Supplier, Estimator, EmailTemplate, AppSettings } from "@/types";

interface SyncQueueItem {
  id: string;
  type: "job" | "supplier" | "estimator" | "template" | "settings";
  key: string;
  data: unknown;
  timestamp: number;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
}

interface RenifyDB extends DBSchema {
  jobs: {
    key: string;
    value: Job & { _cachedAt: number };
    indexes: { "by-status": string };
  };
  suppliers: {
    key: string;
    value: Supplier & { _cachedAt: number };
    indexes: { "by-status": string };
  };
  estimators: {
    key: string;
    value: Estimator & { _cachedAt: number };
  };
  templates: {
    key: string;
    value: EmailTemplate & { _cachedAt: number };
  };
  settings: {
    key: string;
    value: AppSettings & { _cachedAt: number };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { "by-status": string };
  };
}

const DB_NAME = "renify-offline";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<RenifyDB> | null = null;

function isClient(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

async function getDB(): Promise<IDBPDatabase<RenifyDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<RenifyDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Jobs store
      const jobStore = db.createObjectStore("jobs", { keyPath: "jobCode" });
      jobStore.createIndex("by-status", "status");

      // Suppliers store
      const supStore = db.createObjectStore("suppliers", { keyPath: "id" });
      supStore.createIndex("by-status", "status");

      // Estimators store
      db.createObjectStore("estimators", { keyPath: "id" });

      // Templates store
      db.createObjectStore("templates", { keyPath: "id" });

      // Settings store
      db.createObjectStore("settings");

      // Sync queue
      const syncStore = db.createObjectStore("syncQueue", { keyPath: "id" });
      syncStore.createIndex("by-status", "status");
    },
  });

  return dbInstance;
}

// ---- Jobs ----

export async function getCachedJobs(): Promise<Job[]> {
  if (!isClient()) return [];
  const db = await getDB();
  const all = await db.getAll("jobs");
  return all.map(({ _cachedAt: _unused, ...rest }) => rest as unknown as Job);
}

export async function getCachedJob(jobCode: string): Promise<Job | null> {
  if (!isClient()) return null;
  const db = await getDB();
  const item = await db.get("jobs", jobCode);
  if (!item) return null;
  const { _cachedAt: _unused, ...rest } = item;
  return rest as unknown as Job;
}

export async function cacheJobs(jobs: Job[]): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  const tx = db.transaction("jobs", "readwrite");
  const now = Date.now();
  for (const job of jobs) {
    await tx.store.put({ ...job, _cachedAt: now });
  }
  await tx.done;
}

export async function cacheJob(job: Job): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  await db.put("jobs", { ...job, _cachedAt: Date.now() });
}

// ---- Suppliers ----

export async function getCachedSuppliers(): Promise<Supplier[]> {
  if (!isClient()) return [];
  const db = await getDB();
  const all = await db.getAll("suppliers");
  return all.map(({ _cachedAt: _unused, ...rest }) => rest as unknown as Supplier);
}

export async function cacheSuppliers(suppliers: Supplier[]): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  const tx = db.transaction("suppliers", "readwrite");
  const now = Date.now();
  for (const sup of suppliers) {
    await tx.store.put({ ...sup, _cachedAt: now });
  }
  await tx.done;
}

// ---- Estimators ----

export async function getCachedEstimators(): Promise<Estimator[]> {
  if (!isClient()) return [];
  const db = await getDB();
  const all = await db.getAll("estimators");
  return all.map(({ _cachedAt: _unused, ...rest }) => rest as unknown as Estimator);
}

export async function cacheEstimators(estimators: Estimator[]): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  const tx = db.transaction("estimators", "readwrite");
  const now = Date.now();
  for (const est of estimators) {
    await tx.store.put({ ...est, _cachedAt: now });
  }
  await tx.done;
}

// ---- Templates ----

export async function getCachedTemplates(): Promise<EmailTemplate[]> {
  if (!isClient()) return [];
  const db = await getDB();
  const all = await db.getAll("templates");
  return all.map(({ _cachedAt: _unused, ...rest }) => rest as unknown as EmailTemplate);
}

export async function cacheTemplates(templates: EmailTemplate[]): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  const tx = db.transaction("templates", "readwrite");
  const now = Date.now();
  for (const tpl of templates) {
    await tx.store.put({ ...tpl, _cachedAt: now });
  }
  await tx.done;
}

// ---- Settings ----

export async function getCachedSettings(): Promise<AppSettings | null> {
  if (!isClient()) return null;
  const db = await getDB();
  const item = await db.get("settings", "app");
  if (!item) return null;
  const { _cachedAt: _unused, ...rest } = item;
  return rest as unknown as AppSettings;
}

export async function cacheSettings(settings: AppSettings): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  await db.put("settings", { ...settings, _cachedAt: Date.now() }, "app");
}

// ---- Sync Queue ----

export async function addToSyncQueue(
  type: SyncQueueItem["type"],
  key: string,
  data: unknown
): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  const id = `${type}-${key}-${Date.now()}`;
  await db.put("syncQueue", {
    id,
    type,
    key,
    data,
    timestamp: Date.now(),
    status: "pending",
    retryCount: 0,
  });
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  if (!isClient()) return [];
  const db = await getDB();
  return db.getAllFromIndex("syncQueue", "by-status", "pending");
}

export async function updateSyncItem(
  id: string,
  updates: Partial<Pick<SyncQueueItem, "status" | "retryCount">>
): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  const item = await db.get("syncQueue", id);
  if (!item) return;
  await db.put("syncQueue", { ...item, ...updates });
}

export async function removeSyncItem(id: string): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  await db.delete("syncQueue", id);
}

export async function getSyncQueueCount(): Promise<number> {
  if (!isClient()) return 0;
  const db = await getDB();
  return db.countFromIndex("syncQueue", "by-status", "pending");
}

// ---- Clear all ----

export async function clearAllCaches(): Promise<void> {
  if (!isClient()) return;
  const db = await getDB();
  const storeNames = ["jobs", "suppliers", "estimators", "templates", "settings", "syncQueue"] as const;
  for (const store of storeNames) {
    const tx = db.transaction(store, "readwrite");
    await tx.store.clear();
    await tx.done;
  }
}
