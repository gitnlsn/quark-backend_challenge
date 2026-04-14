import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';
import { AiService } from '../src/ai/ai.service.js';
import {
  LeadSource,
  LeadStatus,
  ProcessingStatus,
  type Lead,
  type Enrichment,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ConfigService } from '@nestjs/config';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'tinyllama';

const lead: Lead = {
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

const enrichment: Enrichment = {
  id: 'enrich-1',
  leadId: lead.id,
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

function createService(): AiService {
  const config = {
    get: (key: string, defaultValue: string) => {
      if (key === 'OLLAMA_URL') return OLLAMA_URL;
      if (key === 'OLLAMA_MODEL') return OLLAMA_MODEL;
      return defaultValue;
    },
  } as ConfigService;
  return new AiService(config);
}

function assertValidClassification(result: {
  score: number;
  classification: string;
  justification: string;
  commercialPotential: string;
  modelUsed: string;
}) {
  expect(result.score).toBeGreaterThanOrEqual(0);
  expect(result.score).toBeLessThanOrEqual(100);
  expect(Number.isInteger(result.score)).toBe(true);
  expect(['Hot', 'Warm', 'Cold']).toContain(result.classification);
  expect(result.justification).toBeTruthy();
  expect(['High', 'Medium', 'Low']).toContain(result.commercialPotential);
  expect(result.modelUsed).toContain(OLLAMA_MODEL);
}

describe('AiService Integration (classify)', () => {
  let service: AiService;
  let ollamaAvailable = false;

  beforeAll(async () => {
    try {
      await axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 5000 });
      ollamaAvailable = true;
    } catch {
      console.warn(
        `Ollama is not reachable at ${OLLAMA_URL} — skipping integration tests`,
      );
    }
    service = createService();
  });

  it('should classify a lead with enrichment data', async () => {
    if (!ollamaAvailable) return;

    const result = await service.classify(lead, enrichment);
    assertValidClassification(result);
  });

  it('should classify a lead without enrichment data', async () => {
    if (!ollamaAvailable) return;

    const result = await service.classify(lead, null);
    assertValidClassification(result);
  });

  it('should classify a lead with an estimated value', async () => {
    if (!ollamaAvailable) return;

    const leadWithValue: Lead = {
      ...lead,
      estimatedValue: new Decimal(250000),
    };

    const result = await service.classify(leadWithValue, enrichment);
    assertValidClassification(result);
  });
});
