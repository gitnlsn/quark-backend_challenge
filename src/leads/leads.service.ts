import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLeadDto } from './dto/create-lead.dto.js';
import { UpdateLeadDto } from './dto/update-lead.dto.js';
import { LeadQueryDto } from './dto/lead-query.dto.js';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadDto) {
    try {
      return await this.prisma.lead.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.includes('email')) {
          throw new ConflictException('A lead with this email already exists');
        }
        if (target.includes('companyCnpj')) {
          throw new ConflictException('A lead with this CNPJ already exists');
        }
        throw new ConflictException('Duplicate value');
      }
      throw error;
    }
  }

  async findAll(query: LeadQueryDto) {
    const { ids, status, source, search, page = 1, limit = 20 } = query;
    const where: Prisma.LeadWhereInput = {};

    if (ids?.length) where.id = { in: ids };
    if (status) where.status = status;
    if (source) where.source = source;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        enrichments: { orderBy: { createdAt: 'desc' } },
        classifications: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) throw new NotFoundException(`Lead with id ${id} not found`);
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findOne(id);
    try {
      return await this.prisma.lead.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Duplicate value');
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.lead.delete({ where: { id } });
    return { deleted: true };
  }
}
