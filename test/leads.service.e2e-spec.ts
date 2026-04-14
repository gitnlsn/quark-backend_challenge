import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LeadsService } from '../src/leads/leads.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  createTestPrisma,
  isTestDbAvailable,
  uniqueLead,
} from './helpers/prisma-test.helper.js';

describe('LeadsService Integration (PostgreSQL)', () => {
  let leadsService: LeadsService;
  let prisma: PrismaService;
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isTestDbAvailable();
    if (!dbAvailable) return;

    prisma = await createTestPrisma();

    const moduleRef = await Test.createTestingModule({
      providers: [LeadsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    leadsService = moduleRef.get(LeadsService);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  // --- create ---

  it('should create a lead and persist it in the database', async () => {
    if (!dbAvailable) return;

    const data = uniqueLead();
    const result = await leadsService.create(data);

    expect(result.id).toBeDefined();
    expect(result.fullName).toBe(data.fullName);
    expect(result.email).toBe(data.email);
    expect(result.status).toBe('PENDING');

    const found = await prisma.lead.findUnique({ where: { id: result.id } });
    expect(found).not.toBeNull();
    expect(found!.email).toBe(data.email);
  });

  it('should throw ConflictException for duplicate email', async () => {
    if (!dbAvailable) return;

    const data = uniqueLead();
    await leadsService.create(data);

    await expect(
      leadsService.create(uniqueLead({ email: data.email })),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException for duplicate CNPJ', async () => {
    if (!dbAvailable) return;

    const data = uniqueLead();
    await leadsService.create(data);

    await expect(
      leadsService.create(uniqueLead({ companyCnpj: data.companyCnpj })),
    ).rejects.toThrow(ConflictException);
  });

  // --- findAll ---

  it('should return paginated results', async () => {
    if (!dbAvailable) return;

    const createdIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const lead = await leadsService.create(uniqueLead());
      createdIds.push(lead.id);
    }

    const page1 = await leadsService.findAll({
      ids: createdIds,
      page: 1,
      limit: 2,
    });
    expect(page1.data).toHaveLength(2);
    expect(page1.meta.total).toBe(5);
    expect(page1.meta.totalPages).toBe(3);

    const page3 = await leadsService.findAll({
      ids: createdIds,
      page: 3,
      limit: 2,
    });
    expect(page3.data).toHaveLength(1);
  });

  it('should filter by status', async () => {
    if (!dbAvailable) return;

    const lead1 = await leadsService.create(uniqueLead());
    await prisma.lead.update({
      where: { id: lead1.id },
      data: { status: 'ENRICHED' },
    });

    const lead2 = await leadsService.create(uniqueLead());
    const ids = [lead1.id, lead2.id];

    const result = await leadsService.findAll({ ids, status: 'ENRICHED' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(lead1.id);
  });

  it('should filter by source', async () => {
    if (!dbAvailable) return;

    const lead1 = await leadsService.create(uniqueLead());
    const lead2 = await leadsService.create(uniqueLead({ source: 'REFERRAL' }));
    const ids = [lead1.id, lead2.id];

    const result = await leadsService.findAll({ ids, source: 'REFERRAL' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].source).toBe('REFERRAL');
  });

  it('should search by fullName (case-insensitive)', async () => {
    if (!dbAvailable) return;

    const lead1 = await leadsService.create(
      uniqueLead({ fullName: 'Alice Wonderland' }),
    );
    const lead2 = await leadsService.create(
      uniqueLead({ fullName: 'Bob Builder' }),
    );
    const ids = [lead1.id, lead2.id];

    const result = await leadsService.findAll({ ids, search: 'alice' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].fullName).toBe('Alice Wonderland');
  });

  // --- findOne ---

  it('should return a lead with enrichments and classifications', async () => {
    if (!dbAvailable) return;

    const lead = await leadsService.create(uniqueLead());

    await prisma.enrichment.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date(),
        status: 'SUCCESS',
        companyName: 'Test Corp',
      },
    });

    await prisma.aiClassification.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date(),
        status: 'SUCCESS',
        score: 85,
        classification: 'Hot',
      },
    });

    const result = await leadsService.findOne(lead.id);
    expect(result.enrichments).toHaveLength(1);
    expect(result.classifications).toHaveLength(1);
    expect(result.classifications[0].score).toBe(85);
  });

  it('should throw NotFoundException for non-existent lead', async () => {
    if (!dbAvailable) return;

    await expect(
      leadsService.findOne('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(NotFoundException);
  });

  // --- update ---

  it('should update a lead and return updated data', async () => {
    if (!dbAvailable) return;

    const lead = await leadsService.create(uniqueLead());
    const updated = await leadsService.update(lead.id, {
      fullName: 'Updated Name',
      notes: 'Updated lead',
    });

    expect(updated.fullName).toBe('Updated Name');
    expect(updated.notes).toBe('Updated lead');
  });

  it('should throw NotFoundException when updating non-existent lead', async () => {
    if (!dbAvailable) return;

    await expect(
      leadsService.update('00000000-0000-0000-0000-000000000000', {
        fullName: 'Ghost',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // --- remove ---

  it('should delete a lead', async () => {
    if (!dbAvailable) return;

    const lead = await leadsService.create(uniqueLead());
    const result = await leadsService.remove(lead.id);

    expect(result).toEqual({ deleted: true });

    const found = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(found).toBeNull();
  });

  it('should cascade delete enrichments and classifications', async () => {
    if (!dbAvailable) return;

    const lead = await leadsService.create(uniqueLead());

    await prisma.enrichment.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date(),
        status: 'SUCCESS',
      },
    });

    await prisma.aiClassification.create({
      data: {
        leadId: lead.id,
        requestedAt: new Date(),
        status: 'SUCCESS',
      },
    });

    await leadsService.remove(lead.id);

    const enrichments = await prisma.enrichment.findMany({
      where: { leadId: lead.id },
    });
    const classifications = await prisma.aiClassification.findMany({
      where: { leadId: lead.id },
    });

    expect(enrichments).toHaveLength(0);
    expect(classifications).toHaveLength(0);
  });

  it('should throw NotFoundException when removing non-existent lead', async () => {
    if (!dbAvailable) return;

    await expect(
      leadsService.remove('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(NotFoundException);
  });
});
