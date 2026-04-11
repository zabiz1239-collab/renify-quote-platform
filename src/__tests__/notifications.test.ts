import { describe, it, expect } from 'vitest';
import { getExpiringQuotes, isJobFullyQuoted } from '@/lib/notifications';
import type { Job } from '@/types';

function makeJobWithQuotes(trades: { code: string; name: string; quotes: { status: string; quoteExpiry?: string; supplierName?: string }[] }[]): Job {
  return {
    jobCode: 'TEST01',
    address: '1 Test St',
    client: { name: 'Test' },
    region: 'Western',
    buildType: 'New Build',
    storeys: 'Single',
    estimatorId: 'est-001',
    status: 'quoting',
    documents: [],
    trades: trades.map((t) => ({
      code: t.code,
      name: t.name,
      quotes: t.quotes.map((q) => ({
        supplierId: 'sup-001',
        supplierName: q.supplierName || 'Test Supplier',
        status: q.status as "not_started" | "requested" | "received" | "accepted" | "declined",
        version: 1,
        followUpCount: 0,
        quoteExpiry: q.quoteExpiry,
      })),
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('getExpiringQuotes', () => {
  it('returns expiring quotes within warning threshold', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 15); // 15 days from now

    const job = makeJobWithQuotes([
      {
        code: '110',
        name: 'CONCRETE SUPPLY',
        quotes: [{ status: 'received', quoteExpiry: soon.toISOString(), supplierName: 'EcoConcrete' }],
      },
    ]);

    const results = getExpiringQuotes(job, [30, 60, 90]);
    expect(results).toHaveLength(1);
    expect(results[0].tradeName).toBe('CONCRETE SUPPLY');
    expect(results[0].supplierName).toBe('EcoConcrete');
    expect(results[0].severity).toBe('danger');
  });

  it('returns empty for no expiring quotes', () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 200); // 200 days away

    const job = makeJobWithQuotes([
      {
        code: '110',
        name: 'CONCRETE SUPPLY',
        quotes: [{ status: 'received', quoteExpiry: farFuture.toISOString() }],
      },
    ]);

    const results = getExpiringQuotes(job, [30, 60, 90]);
    expect(results).toHaveLength(0);
  });

  it('returns expired quotes with severity "expired"', () => {
    const past = new Date();
    past.setDate(past.getDate() - 10); // 10 days ago

    const job = makeJobWithQuotes([
      {
        code: '315',
        name: 'PLUMBER',
        quotes: [{ status: 'received', quoteExpiry: past.toISOString(), supplierName: 'JustPlumb' }],
      },
    ]);

    const results = getExpiringQuotes(job, [30, 60, 90]);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('expired');
  });

  it('ignores quotes without expiry date', () => {
    const job = makeJobWithQuotes([
      {
        code: '110',
        name: 'CONCRETE SUPPLY',
        quotes: [{ status: 'received' }],
      },
    ]);

    const results = getExpiringQuotes(job, [30, 60, 90]);
    expect(results).toHaveLength(0);
  });

  it('ignores quotes that are not received or accepted', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 10);

    const job = makeJobWithQuotes([
      {
        code: '110',
        name: 'CONCRETE SUPPLY',
        quotes: [{ status: 'requested', quoteExpiry: soon.toISOString() }],
      },
    ]);

    const results = getExpiringQuotes(job, [30, 60, 90]);
    expect(results).toHaveLength(0);
  });
});

describe('isJobFullyQuoted', () => {
  it('returns true when all trades have a received quote', () => {
    const job = makeJobWithQuotes([
      { code: '110', name: 'CONCRETE SUPPLY', quotes: [{ status: 'received' }] },
      { code: '315', name: 'PLUMBER', quotes: [{ status: 'accepted' }] },
    ]);
    expect(isJobFullyQuoted(job)).toBe(true);
  });

  it('returns false when some trades have no received/accepted quotes', () => {
    const job = makeJobWithQuotes([
      { code: '110', name: 'CONCRETE SUPPLY', quotes: [{ status: 'received' }] },
      { code: '315', name: 'PLUMBER', quotes: [{ status: 'requested' }] },
    ]);
    expect(isJobFullyQuoted(job)).toBe(false);
  });

  it('returns false for empty trades', () => {
    const job = makeJobWithQuotes([]);
    expect(isJobFullyQuoted(job)).toBe(false);
  });
});
