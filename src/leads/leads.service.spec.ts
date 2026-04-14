import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, LeadStatus, LeadSource } from '@prisma/client';
import { LeadsService } from './leads.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const mockLead = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  fullName: 'João Silva',
  email: 'joao@example.com',
  phone: '+5511999991111',
  companyName: 'Tech Corp',
  companyCnpj: '11222333000181',
  companyWebsite: null,
  estimatedValue: null,
  source: LeadSource.WEBSITE,
  notes: null,
  status: LeadStatus.PENDING,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: {
    lead: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      lead: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [LeadsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(LeadsService);
  });

  describe('create', () => {
    it('should create a lead', async () => {
      prisma.lead.create.mockResolvedValue(mockLead);
      const result = await service.create({
        fullName: 'João Silva',
        email: 'joao@example.com',
        phone: '+5511999991111',
        companyName: 'Tech Corp',
        companyCnpj: '11222333000181',
        source: LeadSource.WEBSITE,
      });
      expect(result).toEqual(mockLead);
    });

    it('should throw ConflictException on duplicate email', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', meta: { target: ['email'] }, clientVersion: '6.0.0' },
      );
      prisma.lead.create.mockRejectedValue(error);

      await expect(
        service.create({
          fullName: 'João Silva',
          email: 'joao@example.com',
          phone: '+5511999991111',
          companyName: 'Tech Corp',
          companyCnpj: '11222333000181',
          source: LeadSource.WEBSITE,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException on duplicate CNPJ', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          meta: { target: ['companyCnpj'] },
          clientVersion: '6.0.0',
        },
      );
      prisma.lead.create.mockRejectedValue(error);

      await expect(
        service.create({
          fullName: 'João Silva',
          email: 'joao@example.com',
          phone: '+5511999991111',
          companyName: 'Tech Corp',
          companyCnpj: '11222333000181',
          source: LeadSource.WEBSITE,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated leads', async () => {
      prisma.lead.findMany.mockResolvedValue([mockLead]);
      prisma.lead.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.lead.findMany.mockResolvedValue([]);
      prisma.lead.count.mockResolvedValue(0);

      await service.findAll({
        status: LeadStatus.ENRICHED,
        page: 1,
        limit: 20,
      });
      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: LeadStatus.ENRICHED,
          }) as Record<string, unknown>,
        }) as Record<string, unknown>,
      );
    });
  });

  describe('findOne', () => {
    it('should return a lead by id', async () => {
      prisma.lead.findUnique.mockResolvedValue(mockLead);
      const result = await service.findOne(mockLead.id);
      expect(result).toEqual(mockLead);
    });

    it('should throw NotFoundException if lead not found', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a lead', async () => {
      const updated = { ...mockLead, fullName: 'João Updated' };
      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.lead.update.mockResolvedValue(updated);

      const result = await service.update(mockLead.id, {
        fullName: 'João Updated',
      });
      expect(result.fullName).toBe('João Updated');
    });

    it('should throw NotFoundException for non-existent lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(
        service.update('nonexistent-id', { fullName: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.lead.delete.mockResolvedValue(mockLead);

      const result = await service.remove(mockLead.id);
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException for non-existent lead', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);
      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
