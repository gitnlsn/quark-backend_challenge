import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ExportService } from '../src/export/export.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestPrisma,
  isTestDbAvailable,
  uniqueLead,
} from './helpers/prisma-test.helper.js';

describe('ExportService Integration (PostgreSQL)', () => {
  let exportService: ExportService;
  let prisma: PrismaService;
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isTestDbAvailable();
    if (!dbAvailable) return;

    prisma = await createTestPrisma();

    const moduleRef = await Test.createTestingModule({
      providers: [ExportService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    exportService = moduleRef.get(ExportService);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('should export leads with latest enrichment and classification', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({ data: uniqueLead() });

    await prisma.enrichment.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date('2024-01-01'),
        status: 'SUCCESS',
        companyName: 'Old Enrichment',
      },
    });
    await prisma.enrichment.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date('2024-06-01'),
        status: 'SUCCESS',
        companyName: 'Latest Enrichment',
      },
    });

    await prisma.aiClassification.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date('2024-06-01'),
        status: 'SUCCESS',
        score: 90,
        classification: 'Hot',
      },
    });

    const result = await exportService.exportLeads({ ids: [lead.id] });

    expect(result).toHaveLength(1);
    expect(result[0].lead.id).toBe(lead.id);
    expect(result[0].latestEnrichment?.companyName).toBe('Latest Enrichment');
    expect(result[0].latestClassification?.score).toBe(90);
    expect(result[0].enrichmentCount).toBe(2);
    expect(result[0].classificationCount).toBe(1);
  });

  it('should filter by status', async () => {
    if (!dbAvailable) return;

    const lead1 = await prisma.lead.create({ data: uniqueLead() });
    const lead2 = await prisma.lead.create({
      data: uniqueLead({ status: 'ENRICHED' }),
    });
    const ids = [lead1.id, lead2.id];

    const result = await exportService.exportLeads({ ids, status: 'ENRICHED' });
    expect(result).toHaveLength(1);
    expect(result[0].lead.status).toBe('ENRICHED');
  });

  it('should filter by source', async () => {
    if (!dbAvailable) return;

    const lead1 = await prisma.lead.create({ data: uniqueLead() });
    const lead2 = await prisma.lead.create({
      data: uniqueLead({ source: 'REFERRAL' }),
    });
    const ids = [lead1.id, lead2.id];

    const result = await exportService.exportLeads({ ids, source: 'REFERRAL' });
    expect(result).toHaveLength(1);
    expect(result[0].lead.source).toBe('REFERRAL');
  });

  it('should return empty array when no leads match the given ids', async () => {
    if (!dbAvailable) return;

    const result = await exportService.exportLeads({
      ids: ['00000000-0000-0000-0000-000000000000'],
    });
    expect(result).toHaveLength(0);
  });

  it('should return null for latestEnrichment/Classification when none exist', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({ data: uniqueLead() });

    const result = await exportService.exportLeads({ ids: [lead.id] });

    expect(result).toHaveLength(1);
    expect(result[0].latestEnrichment).toBeNull();
    expect(result[0].latestClassification).toBeNull();
    expect(result[0].enrichmentCount).toBe(0);
    expect(result[0].classificationCount).toBe(0);
  });
});
