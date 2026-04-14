import { Injectable } from '@nestjs/common';
import { LeadSource, LeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ExportQuery {
  ids?: string[];
  status?: LeadStatus;
  source?: LeadSource;
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportLeads(query: ExportQuery) {
    const where: Record<string, unknown> = {};
    if (query.ids?.length) where.id = { in: query.ids };
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        enrichments: { orderBy: { createdAt: 'desc' } },
        classifications: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return leads.map((lead) => ({
      lead: {
        id: lead.id,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        companyName: lead.companyName,
        companyCnpj: lead.companyCnpj,
        companyWebsite: lead.companyWebsite,
        estimatedValue: lead.estimatedValue,
        source: lead.source,
        notes: lead.notes,
        status: lead.status,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      },
      latestEnrichment: lead.enrichments[0] ?? null,
      latestClassification: lead.classifications[0] ?? null,
      enrichmentCount: lead.enrichments.length,
      classificationCount: lead.classifications.length,
    }));
  }
}
