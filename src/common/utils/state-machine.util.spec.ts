import { describe, it, expect } from 'vitest';
import { LeadStatus } from '@prisma/client';
import {
  isValidTransition,
  canEnrich,
  canClassify,
} from './state-machine.util.js';

describe('isValidTransition', () => {
  const validTransitions: [LeadStatus, LeadStatus][] = [
    [LeadStatus.PENDING, LeadStatus.ENRICHING],
    [LeadStatus.ENRICHING, LeadStatus.ENRICHED],
    [LeadStatus.ENRICHING, LeadStatus.FAILED],
    [LeadStatus.ENRICHED, LeadStatus.CLASSIFYING],
    [LeadStatus.ENRICHED, LeadStatus.ENRICHING],
    [LeadStatus.CLASSIFYING, LeadStatus.CLASSIFIED],
    [LeadStatus.CLASSIFYING, LeadStatus.FAILED],
    [LeadStatus.CLASSIFIED, LeadStatus.CLASSIFYING],
    [LeadStatus.CLASSIFIED, LeadStatus.ENRICHING],
    [LeadStatus.FAILED, LeadStatus.ENRICHING],
    [LeadStatus.FAILED, LeadStatus.CLASSIFYING],
  ];

  it.each(validTransitions)(
    'should allow transition from %s to %s',
    (from, to) => {
      expect(isValidTransition(from, to)).toBe(true);
    },
  );

  const invalidTransitions: [LeadStatus, LeadStatus][] = [
    [LeadStatus.PENDING, LeadStatus.CLASSIFIED],
    [LeadStatus.PENDING, LeadStatus.CLASSIFYING],
    [LeadStatus.ENRICHING, LeadStatus.CLASSIFYING],
    [LeadStatus.ENRICHED, LeadStatus.PENDING],
    [LeadStatus.CLASSIFIED, LeadStatus.PENDING],
    [LeadStatus.FAILED, LeadStatus.CLASSIFIED],
    [LeadStatus.FAILED, LeadStatus.ENRICHED],
  ];

  it.each(invalidTransitions)(
    'should reject transition from %s to %s',
    (from, to) => {
      expect(isValidTransition(from, to)).toBe(false);
    },
  );
});

describe('canEnrich', () => {
  it('should return true for PENDING', () => {
    expect(canEnrich(LeadStatus.PENDING)).toBe(true);
  });

  it('should return true for ENRICHED (re-enrich)', () => {
    expect(canEnrich(LeadStatus.ENRICHED)).toBe(true);
  });

  it('should return true for CLASSIFIED (re-enrich)', () => {
    expect(canEnrich(LeadStatus.CLASSIFIED)).toBe(true);
  });

  it('should return true for FAILED', () => {
    expect(canEnrich(LeadStatus.FAILED)).toBe(true);
  });

  it('should return false for ENRICHING', () => {
    expect(canEnrich(LeadStatus.ENRICHING)).toBe(false);
  });

  it('should return false for CLASSIFYING', () => {
    expect(canEnrich(LeadStatus.CLASSIFYING)).toBe(false);
  });
});

describe('canClassify', () => {
  it('should return true for ENRICHED', () => {
    expect(canClassify(LeadStatus.ENRICHED)).toBe(true);
  });

  it('should return true for CLASSIFIED (re-classify)', () => {
    expect(canClassify(LeadStatus.CLASSIFIED)).toBe(true);
  });

  it('should return true for FAILED', () => {
    expect(canClassify(LeadStatus.FAILED)).toBe(true);
  });

  it('should return false for PENDING', () => {
    expect(canClassify(LeadStatus.PENDING)).toBe(false);
  });

  it('should return false for ENRICHING', () => {
    expect(canClassify(LeadStatus.ENRICHING)).toBe(false);
  });
});
