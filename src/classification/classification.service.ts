import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { CLASSIFICATION_QUEUE } from '../queue/queue.constants.js';
import { canClassify } from '../common/utils/state-machine.util.js';

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async requestClassification(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead with id ${leadId} not found`);

    if (!canClassify(lead.status)) {
      throw new BadRequestException(
        `Cannot classify lead in status ${lead.status}`,
      );
    }

    const requestedAt = new Date().toISOString();

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: 'CLASSIFYING' },
    });

    await this.queue.publish(CLASSIFICATION_QUEUE, { leadId, requestedAt });
    this.logger.log(`Classification requested for lead ${leadId}`);

    return { message: 'Classification request queued', leadId, requestedAt };
  }

  async getClassificationHistory(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead with id ${leadId} not found`);

    return this.prisma.aiClassification.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
