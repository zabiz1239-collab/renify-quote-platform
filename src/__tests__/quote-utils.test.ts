import { describe, it, expect } from 'vitest';
import {
  getQuoteFileName,
  getNextVersion,
  checkDuplicateHash,
} from '@/lib/quote-utils';

describe('getQuoteFileName', () => {
  it('generates correct filename', () => {
    const result = getQuoteFileName('CONCRETE SUPPLY', 'EcoConcrete', 1);
    expect(result).toBe('concrete_supply_quote_by_EcoConcrete_v1.pdf');
  });

  it('handles spaces in supplier name', () => {
    const result = getQuoteFileName('PLUMBER', 'Just Plumb Plumbing', 2);
    expect(result).toBe('plumber_quote_by_Just_Plumb_Plumbing_v2.pdf');
  });

  it('strips special characters from trade name', () => {
    const result = getQuoteFileName('FASCIA & GUTTER', 'RoofRight', 1);
    expect(result).toBe('fascia__gutter_quote_by_RoofRight_v1.pdf');
  });

  it('increments version number', () => {
    const v1 = getQuoteFileName('PAINTING', 'TopCoat', 1);
    const v3 = getQuoteFileName('PAINTING', 'TopCoat', 3);
    expect(v1).toBe('painting_quote_by_TopCoat_v1.pdf');
    expect(v3).toBe('painting_quote_by_TopCoat_v3.pdf');
  });
});

describe('getNextVersion', () => {
  it('returns 1 when no existing quotes', () => {
    expect(getNextVersion([], 'sup-001')).toBe(1);
  });

  it('returns next version number', () => {
    const existing = [
      { supplierId: 'sup-001', version: 1 },
      { supplierId: 'sup-001', version: 2 },
      { supplierId: 'sup-002', version: 1 },
    ];
    expect(getNextVersion(existing, 'sup-001')).toBe(3);
  });

  it('ignores other suppliers', () => {
    const existing = [
      { supplierId: 'sup-002', version: 5 },
      { supplierId: 'sup-003', version: 3 },
    ];
    expect(getNextVersion(existing, 'sup-001')).toBe(1);
  });
});

describe('checkDuplicateHash', () => {
  it('returns isDuplicate false when no match', () => {
    const quotes = [
      { fileHash: 'abc123', supplierName: 'Test', quotePDF: 'test.pdf' },
    ];
    const result = checkDuplicateHash('xyz999', quotes);
    expect(result.isDuplicate).toBe(false);
  });

  it('returns isDuplicate true with existing file info', () => {
    const quotes = [
      { fileHash: 'abc123', supplierName: 'EcoConcrete', quotePDF: 'concrete_v1.pdf' },
      { fileHash: 'def456', supplierName: 'SparkBros', quotePDF: 'elec_v1.pdf' },
    ];
    const result = checkDuplicateHash('def456', quotes);
    expect(result.isDuplicate).toBe(true);
    expect(result.existingSupplier).toBe('SparkBros');
    expect(result.existingFile).toBe('elec_v1.pdf');
  });

  it('handles empty quotes array', () => {
    const result = checkDuplicateHash('abc123', []);
    expect(result.isDuplicate).toBe(false);
  });

  it('handles quotes without fileHash', () => {
    const quotes = [
      { supplierName: 'Test', quotePDF: 'test.pdf' },
    ];
    const result = checkDuplicateHash('abc123', quotes);
    expect(result.isDuplicate).toBe(false);
  });
});
