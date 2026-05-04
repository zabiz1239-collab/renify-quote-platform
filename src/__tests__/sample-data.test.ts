import { describe, it, expect } from 'vitest';
import { SAMPLE_JOBS, SAMPLE_SUPPLIERS, SAMPLE_ESTIMATORS } from '@/data/sample-data';

describe('Sample Data - Jobs', () => {
  it('SAMPLE_JOBS has 4 jobs', () => {
    expect(SAMPLE_JOBS).toHaveLength(4);
  });

  it('all jobs have required fields', () => {
    for (const job of SAMPLE_JOBS) {
      expect(job.jobCode).toBeTruthy();
      expect(job.address).toBeTruthy();
      expect(job.region).toBeTruthy();
      expect(job.trades).toBeDefined();
      expect(Array.isArray(job.trades)).toBe(true);
    }
  });

  it('jobs have populated quotes (not all empty)', () => {
    const totalQuotes = SAMPLE_JOBS.reduce(
      (sum, job) =>
        sum + job.trades.reduce((tSum, trade) => tSum + trade.quotes.length, 0),
      0
    );
    expect(totalQuotes).toBeGreaterThan(0);
  });

  it('the 4th job (GEE15) exists with correct data', () => {
    const gee15 = SAMPLE_JOBS.find((j) => j.jobCode === 'GEE15');
    expect(gee15).toBeDefined();
    expect(gee15!.address).toBe('15 Moorabool St Geelong');
    expect(gee15!.region).toBe('Geelong');
    expect(gee15!.buildType).toBe('Dual Occ');
    expect(gee15!.storeys).toBe('Double');
    expect(gee15!.estimatorId).toBe('est-002');
  });
});

describe('Sample Data - Suppliers', () => {
  it('SAMPLE_SUPPLIERS has 8 suppliers', () => {
    expect(SAMPLE_SUPPLIERS).toHaveLength(8);
  });

  it('all suppliers have required fields', () => {
    for (const supplier of SAMPLE_SUPPLIERS) {
      expect(supplier.id).toBeTruthy();
      expect(supplier.company).toBeTruthy();
      expect(supplier.contact).toBeTruthy();
      expect(supplier.email).toBeTruthy();
      expect(supplier.phone).toBeTruthy();
      expect(supplier.trades).toBeDefined();
      expect(Array.isArray(supplier.trades)).toBe(true);
      expect(supplier.trades.length).toBeGreaterThan(0);
      expect(supplier.regions).toBeDefined();
      expect(Array.isArray(supplier.regions)).toBe(true);
      expect(supplier.regions.length).toBeGreaterThan(0);
      expect(['verified', 'unverified', 'blacklisted']).toContain(supplier.status);
      expect(supplier.rating).toBeGreaterThanOrEqual(1);
      expect(supplier.rating).toBeLessThanOrEqual(5);
    }
  });
});

describe('Sample Data - Estimators', () => {
  it('SAMPLE_ESTIMATORS has 2 estimators', () => {
    expect(SAMPLE_ESTIMATORS).toHaveLength(2);
  });

  it('all estimators have required fields', () => {
    for (const est of SAMPLE_ESTIMATORS) {
      expect(est.id).toBeTruthy();
      expect(est.name).toBeTruthy();
      expect(est.email).toBeTruthy();
      expect(est.phone).toBeTruthy();
      expect(est.signature).toBeTruthy();
      expect(est.microsoftAccount).toBeTruthy();
    }
  });
});
