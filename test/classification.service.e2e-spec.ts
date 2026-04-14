import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ClassificationService } from '../src/classification/classification.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { QueueService } from '../src/queue/queue.service.js';
import {
  createTestPrisma,
  isTestDbAvailable,
  uniqueLead,
} from './helpers/prisma-test.helper.js';

describe('ClassificationService Integration (PostgreSQL)', () => {
  let classificationService: ClassificationService;
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
        ClassificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile();

    classificationService = moduleRef.get(ClassificationService);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  // --- requestClassification ---

  it('should request classification for an ENRICHED lead', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({
      data: uniqueLead({ status: 'ENRICHED' }),
    });
    mockQueueService.publish.mockClear();

    const result = await classificationService.requestClassification(lead.id);

    expect(result.message).toBe('Classification request queued');
    expect(result.leadId).toBe(lead.id);
    expect(result.requestedAt).toBeDefined();
    expect(mockQueueService.publish).toHaveBeenCalledOnce();
  });

  it('should throw NotFoundException for non-existent lead', async () => {
    if (!dbAvailable) return;

    await expect(
      classificationService.requestClassification(
        '00000000-0000-0000-0000-000000000000',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when lead is PENDING (not enriched)', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({ data: uniqueLead() });

    await expect(
      classificationService.requestClassification(lead.id),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when lead is CLASSIFYING', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({
      data: uniqueLead({ status: 'CLASSIFYING' }),
    });

    await expect(
      classificationService.requestClassification(lead.id),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow re-classification for CLASSIFIED leads', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({
      data: uniqueLead({ status: 'CLASSIFIED' }),
    });
    mockQueueService.publish.mockClear();

    const result = await classificationService.requestClassification(lead.id);
    expect(result.leadId).toBe(lead.id);
    expect(mockQueueService.publish).toHaveBeenCalledOnce();
  });

  // --- getClassificationHistory ---

  it('should return classification history ordered by createdAt desc', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({
      data: uniqueLead({ status: 'CLASSIFIED' }),
    });

    await prisma.aiClassification.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date('2024-01-01'),
        status: 'SUCCESS',
        score: 40,
        classification: 'Cold',
      },
    });

    await prisma.aiClassification.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date('2024-06-01'),
        status: 'SUCCESS',
        score: 85,
        classification: 'Hot',
      },
    });

    const history = await classificationService.getClassificationHistory(
      lead.id,
    );

    expect(history).toHaveLength(2);
    expect(history[0].classification).toBe('Hot');
    expect(history[1].classification).toBe('Cold');
  });

  it('should return empty array when lead has no classifications', async () => {
    if (!dbAvailable) return;

    const lead = await prisma.lead.create({ data: uniqueLead() });
    const history = await classificationService.getClassificationHistory(
      lead.id,
    );

    expect(history).toHaveLength(0);
  });

  it('should throw NotFoundException for classification history of non-existent lead', async () => {
    if (!dbAvailable) return;

    await expect(
      classificationService.getClassificationHistory(
        '00000000-0000-0000-0000-000000000000',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
