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

      const { leadId, requestedAt } = JSON.parse(msg.content.toString()) as {
        leadId: string;
        requestedAt: string;
      };
      this.logger.log(`Processing classification for lead ${leadId}`);

      void (async () => {
        try {
          await this.processClassification(leadId, requestedAt);
          channel.ack(msg);
        } catch (error) {
          this.logger.error(
            `Failed to process classification for lead ${leadId}`,
            error instanceof Error ? error.stack : error,
          );
          channel.ack(msg);
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

    // Get latest enrichment for AI context
    const latestEnrichment = await this.prisma.enrichment.findFirst({
      where: { leadId, status: ProcessingStatus.SUCCESS },
      orderBy: { createdAt: 'desc' },
    });

    try {
      const result = await this.ai.classify(lead, latestEnrichment);

      await this.prisma.$transaction([
        this.prisma.aiClassification.create({
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
        }),
        this.prisma.lead.update({
          where: { id: leadId },
          data: { status: LeadStatus.CLASSIFIED },
        }),
      ]);

      this.logger.log(`Classification completed for lead ${leadId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.$transaction([
        this.prisma.aiClassification.create({
          data: {
            leadId,
            requestedAt: new Date(requestedAt),
            completedAt: new Date(),
            status: ProcessingStatus.FAILED,
            errorMessage,
          },
        }),
        this.prisma.lead.update({
          where: { id: leadId },
          data: { status: LeadStatus.FAILED },
        }),
      ]);

      this.logger.error(
        `Classification failed for lead ${leadId}: ${errorMessage}`,
      );
    }
  }
}
