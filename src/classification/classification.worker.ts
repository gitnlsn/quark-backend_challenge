import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import {
  LeadStatus,
  ProcessingStatus,
  Classification,
  CommercialPotential,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { AiService } from '../ai/ai.service.js';
import { CLASSIFICATION_QUEUE } from '../queue/queue.constants.js';
import { transitionStatus } from '../common/utils/state-machine.util.js';

@Injectable()
export class ClassificationWorker implements OnModuleInit {
  private readonly logger = new Logger(ClassificationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly ai: AiService,
  ) {}

  async onModuleInit() {
    const channel = this.queue.getChannel();

    await channel.consume(CLASSIFICATION_QUEUE, (msg) => {
      if (!msg) return;

      void (async () => {
        try {
          const { leadId, requestedAt } = JSON.parse(
            msg.content.toString(),
          ) as {
            leadId: string;
            requestedAt: string;
          };
          this.logger.log(`Processing classification for lead ${leadId}`);
          await this.processClassification(leadId, requestedAt);
          channel.ack(msg);
        } catch (error) {
          this.logger.error(
            'Unrecoverable error processing classification message; routing to DLQ',
            error instanceof Error ? error.stack : error,
          );
          channel.nack(msg, false, false);
        }
      })();
    });

    this.logger.log('Classification worker started');
  }

  private async processClassification(leadId: string, requestedAt: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found, skipping`);
      return;
    }

    const latestEnrichment = await this.prisma.enrichment.findFirst({
      where: { leadId, status: ProcessingStatus.SUCCESS },
      orderBy: { createdAt: 'desc' },
    });

    try {
      const result = await this.ai.classify(lead, latestEnrichment);

      await this.prisma.$transaction(async (tx) => {
        await tx.aiClassification.create({
          data: {
            leadId,
            score: result.score,
            classification: result.classification as Classification,
            justification: result.justification,
            commercialPotential:
              result.commercialPotential as CommercialPotential,
            modelUsed: result.modelUsed,
            requestedAt: new Date(requestedAt),
            completedAt: new Date(),
            status: ProcessingStatus.SUCCESS,
          },
        });
        await transitionStatus(tx, leadId, LeadStatus.CLASSIFIED);
      });

      this.logger.log(`Classification completed for lead ${leadId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.$transaction(async (tx) => {
        await tx.aiClassification.create({
          data: {
            leadId,
            requestedAt: new Date(requestedAt),
            completedAt: new Date(),
            status: ProcessingStatus.FAILED,
            errorMessage,
          },
        });
        await transitionStatus(tx, leadId, LeadStatus.FAILED);
      });

      this.logger.error(
        `Classification failed for lead ${leadId}: ${errorMessage}`,
      );
    }
  }
}
