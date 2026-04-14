import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { ENRICHMENT_QUEUE } from '../queue/queue.constants.js';
import { canEnrich } from '../common/utils/state-machine.util.js';

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async requestEnrichment(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead with id ${leadId} not found`);

    if (!canEnrich(lead.status)) {
      throw new BadRequestException(
        `Cannot enrich lead in status ${lead.status}`,
      );
    }

    const requestedAt = new Date().toISOString();

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'ENRICHING' },
    });

    await this.queue.publish(ENRICHMENT_QUEUE, { leadId, requestedAt });
    this.logger.log(`Enrichment requested for lead ${leadId}`);

    return { message: 'Enrichment request queued', leadId, requestedAt };
  }

  async getEnrichmentHistory(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead with id ${leadId} not found`);

    return this.prisma.enrichment.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
