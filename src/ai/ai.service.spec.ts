import { describe, it, expect } from 'vitest';
import { AiService } from './ai.service.js';
import {
  LeadSource,
  LeadStatus,
  ProcessingStatus,
  type Lead,
  type Enrichment,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ConfigService } from '@nestjs/config';

const mockLead: Lead = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  fullName: 'João Silva',
  email: 'joao@example.com',
  phone: '+5511999991111',
  companyName: 'Tech Corp',
  companyCnpj: '11222333000181',
  companyWebsite: 'https://techcorp.com',
  estimatedValue: null,
  source: LeadSource.WEBSITE,
  notes: null,
  status: LeadStatus.ENRICHED,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEnrichment: Enrichment = {
  id: 'enrich-1',
  leadId: mockLead.id,
  companyName: null,
  tradeName: null,
  cnpj: null,
  industry: 'SaaS',
  employeeCount: 120,
  annualRevenue: new Decimal(1500000),
  legalNature: 'Sociedade Empresária Limitada',
  foundedAt: new Date('2015-03-10'),
  address: null,
  cnaes: null,
  partners: null,
  phones: null,
  emails: null,
  requestedAt: new Date(),
  completedAt: null,
  status: ProcessingStatus.SUCCESS,
  errorMessage: null,
  createdAt: new Date(),
};

function createService() {
  const config = {
    get: (key: string, defaultValue: string) => defaultValue,
  } as ConfigService;
  return new AiService(config);
}

describe('AiService', () => {
  describe('buildPrompt', () => {
    it('should include lead information', () => {
      const service = createService();
      const prompt = service.buildPrompt(mockLead, null);
      expect(prompt).toContain('João Silva');
      expect(prompt).toContain('Tech Corp');
      expect(prompt).toContain('WEBSITE');
    });

    it('should include enrichment data when available', () => {
      const service = createService();
      const prompt = service.buildPrompt(mockLead, mockEnrichment);
      expect(prompt).toContain('SaaS');
      expect(prompt).toContain('120');
      expect(prompt).toContain('1500000');
    });

    it('should handle missing enrichment', () => {
      const service = createService();
      const prompt = service.buildPrompt(mockLead, null);
      expect(prompt).not.toContain('Enrichment Data');
    });
  });

  describe('parseResponse', () => {
    it('should parse a valid JSON response', () => {
      const service = createService();
      const result = service.parseResponse(
        '{"score": 85, "classification": "Hot", "justification": "High revenue potential", "commercialPotential": "High"}',
      );
      expect(result.score).toBe(85);
      expect(result.classification).toBe('Hot');
      expect(result.commercialPotential).toBe('High');
    });

    it('should extract JSON from surrounding text', () => {
      const service = createService();
      const result = service.parseResponse(
        'Here is my analysis:\n{"score": 50, "classification": "Warm", "justification": "Moderate potential", "commercialPotential": "Medium"}\nEnd.',
      );
      expect(result.score).toBe(50);
      expect(result.classification).toBe('Warm');
    });

    it('should throw on missing JSON', () => {
      const service = createService();
      expect(() => service.parseResponse('No JSON here')).toThrow(
        'No JSON found',
      );
    });

    it('should throw on invalid score', () => {
      const service = createService();
      expect(() =>
        service.parseResponse(
          '{"score": 150, "classification": "Hot", "justification": "test", "commercialPotential": "High"}',
        ),
      ).toThrow('Invalid score');
    });

    it('should throw on invalid classification', () => {
      const service = createService();
      expect(() =>
        service.parseResponse(
          '{"score": 50, "classification": "Lukewarm", "justification": "test", "commercialPotential": "High"}',
        ),
      ).toThrow('Invalid classification');
    });

    it('should throw on invalid commercialPotential', () => {
      const service = createService();
      expect(() =>
        service.parseResponse(
          '{"score": 50, "classification": "Hot", "justification": "test", "commercialPotential": "VeryHigh"}',
        ),
      ).toThrow('Invalid commercialPotential');
    });

    it('should round decimal scores', () => {
      const service = createService();
      const result = service.parseResponse(
        '{"score": 72.6, "classification": "Warm", "justification": "test", "commercialPotential": "Medium"}',
      );
      expect(result.score).toBe(73);
    });
  });
});
