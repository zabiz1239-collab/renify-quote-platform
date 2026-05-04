import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCachedJobs,
  cacheJobs,
  getCachedSuppliers,
  cacheSuppliers,
  addToSyncQueue,
  getPendingSyncItems,
  removeSyncItem,
  clearAllCaches,
} from '@/lib/offline-store';
import type { Job, Supplier } from '@/types';

const makeJob = (jobCode: string): Job => ({
  jobCode,
  address: '123 Test St',
  region: 'Western',
  buildType: 'New Build',
  storeys: 'Single',
  estimatorId: 'est-001',
  status: 'active',
  documents: [],
  trades: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const makeSupplier = (id: string): Supplier => ({
  id,
  company: `Supplier ${id}`,
  contact: 'Test Contact',
  email: 'test@example.com',
  phone: '0400 000 000',
  trades: ['110'],
  regions: ['Western'],
  status: 'verified',
  rating: 4,
  notes: '',
});

beforeEach(async () => {
  await clearAllCaches();
});

describe('Offline Store - Jobs', () => {
  it('getCachedJobs returns empty array when no data', async () => {
    const jobs = await getCachedJobs();
    expect(jobs).toEqual([]);
  });

  it('cacheJobs + getCachedJobs round trip', async () => {
    const jobs = [makeJob('TEST01'), makeJob('TEST02')];
    await cacheJobs(jobs);
    const cached = await getCachedJobs();
    expect(cached).toHaveLength(2);
    expect(cached.map((j) => j.jobCode).sort()).toEqual(['TEST01', 'TEST02']);
  });
});

describe('Offline Store - Suppliers', () => {
  it('getCachedSuppliers returns empty when no data', async () => {
    const suppliers = await getCachedSuppliers();
    expect(suppliers).toEqual([]);
  });

  it('cacheSuppliers + getCachedSuppliers round trip', async () => {
    const suppliers = [makeSupplier('s1'), makeSupplier('s2'), makeSupplier('s3')];
    await cacheSuppliers(suppliers);
    const cached = await getCachedSuppliers();
    expect(cached).toHaveLength(3);
    expect(cached.map((s) => s.id).sort()).toEqual(['s1', 's2', 's3']);
  });
});

describe('Offline Store - Sync Queue', () => {
  it('addToSyncQueue, getPendingSyncItems, removeSyncItem', async () => {
    // Initially empty
    const empty = await getPendingSyncItems();
    expect(empty).toEqual([]);

    // Add items
    await addToSyncQueue('job', 'TEST01', { jobCode: 'TEST01' });
    await addToSyncQueue('supplier', 's1', { id: 's1' });

    const pending = await getPendingSyncItems();
    expect(pending).toHaveLength(2);
    expect(pending.every((item) => item.status === 'pending')).toBe(true);

    // Remove one
    await removeSyncItem(pending[0].id);
    const afterRemove = await getPendingSyncItems();
    expect(afterRemove).toHaveLength(1);
  });
});

describe('Offline Store - Clear All', () => {
  it('clearAllCaches clears everything', async () => {
    await cacheJobs([makeJob('J1')]);
    await cacheSuppliers([makeSupplier('S1')]);
    await addToSyncQueue('job', 'J1', {});

    // Verify data exists
    expect(await getCachedJobs()).toHaveLength(1);
    expect(await getCachedSuppliers()).toHaveLength(1);
    expect(await getPendingSyncItems()).toHaveLength(1);

    await clearAllCaches();

    expect(await getCachedJobs()).toEqual([]);
    expect(await getCachedSuppliers()).toEqual([]);
    expect(await getPendingSyncItems()).toEqual([]);
  });
});
