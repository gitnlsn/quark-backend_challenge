import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EnrichmentService } from '../src/enrichment/enrichment.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { QueueService } from '../src/queue/queue.service.js';
import {
  createTestPrisma,
  isTestDbAvailable,
  uniqueLead,
} from './helpers/prisma-test.helper.js';

describe('EnrichmentService Integration (PostgreSQL)', () => {
  let enrichmentService: EnrichmentService;
  let prisma: PrismaService;
  let dbAvailable = false;

  const mockQueueService = {
    publish: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    dbAvailable = await isTestDbAvailable();
    if (!dbAvailable) return;

    prisma = await createTestPrisma();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EnrichmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    enrichmentService = moduleRef.get(EnrichmentService);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  // --- requestEnrichment ---

  it('should request enrichment for a PENDING lead and publish to queue', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({ data: uniqueLead() });
    mockQueueService.publish.mockClear();

    const result = await enrichmentService.requestEnrichment(lead.id);

    expect(result.message).toBe('Enrichment request queued');
    expect(result.leadId).toBe(lead.id);
    expect(result.requestedAt).toBeDefined();
    expect(mockQueueService.publish).toHaveBeenCalledOnce();
  });

  it('should throw NotFoundException for non-existent lead', async () => {
    if (!dbAvailable) return;

    await expect(
      enrichmentService.requestEnrichment(
        '00000000-0000-0000-0000-000000000000',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when lead status does not allow enrichment', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({
      data: uniqueLead({ status: 'ENRICHING' }),
    });

    await expect(enrichmentService.requestEnrichment(lead.id)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject the second of two concurrent enrichment requests with ConflictException', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({ data: uniqueLead() });
    mockQueueService.publish.mockClear();

    const results = await Promise.allSettled([
      enrichmentService.requestEnrichment(lead.id),
      enrichmentService.requestEnrichment(lead.id),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason as Error;
    // Loser of the race gets ConflictException (atomic-update miss) or
    // BadRequestException (pre-flight canEnrich check if the first request
    // already transitioned the row to ENRICHING).
    expect(
      reason instanceof ConflictException ||
        reason instanceof BadRequestException,
    ).toBe(true);

    const reloaded = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(reloaded?.status).toBe('ENRICHING');
  });

  it('should allow re-enrichment for ENRICHED leads', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({
      data: uniqueLead({ status: 'ENRICHED' }),
    });
    mockQueueService.publish.mockClear();

    const result = await enrichmentService.requestEnrichment(lead.id);
    expect(result.leadId).toBe(lead.id);
    expect(mockQueueService.publish).toHaveBeenCalledOnce();
  });

  // --- getEnrichmentHistory ---

  it('should return enrichment history ordered by createdAt desc', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({ data: uniqueLead() });

    await prisma.enrichment.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date('2024-01-01'),
        status: 'SUCCESS',
        companyName: 'First',
      },
    });

    await prisma.enrichment.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date('2024-06-01'),
        status: 'SUCCESS',
        companyName: 'Second',
      },
    });

    const history = await enrichmentService.getEnrichmentHistory(lead.id);

    expect(history).toHaveLength(2);
    expect(history[0].companyName).toBe('Second');
    expect(history[1].companyName).toBe('First');
  });

  it('should return empty array when lead has no enrichments', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({ data: uniqueLead() });
    const history = await enrichmentService.getEnrichmentHistory(lead.id);

    expect(history).toHaveLength(0);
  });

  it('should throw NotFoundException for enrichment history of non-existent lead', async () => {
    if (!dbAvailable) return;

    await expect(
      enrichmentService.getEnrichmentHistory(
        '00000000-0000-0000-0000-000000000000',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
