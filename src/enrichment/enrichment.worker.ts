import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { LeadStatus, Prisma, ProcessingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import { MockApiClientService } from '../mock-api-client/mock-api-client.service.js';
import { ENRICHMENT_QUEUE } from '../queue/queue.constants.js';

@Injectable()
export class EnrichmentWorker implements OnModuleInit {
  private readonly logger = new Logger(EnrichmentWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly mockApi: MockApiClientService,
  ) {}

  async onModuleInit() {
    const channel = this.queue.getChannel();

    await channel.consume(ENRICHMENT_QUEUE, (msg) => {
      if (!msg) return;

      const { leadId, requestedAt } = JSON.parse(msg.content.toString()) as {
        leadId: string;
        requestedAt: string;
      };
      this.logger.log(`Processing enrichment for lead ${leadId}`);

      void (async () => {
        try {
          await this.processEnrichment(leadId, requestedAt);
          channel.ack(msg);
        } catch (error) {
          this.logger.error(
            `Failed to process enrichment for lead ${leadId}`,
            error instanceof Error ? error.stack : error,
          );
          channel.ack(msg);
        }
      })();
    });

    this.logger.log('Enrichment worker started');
  }

  private async processEnrichment(leadId: string, requestedAt: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found, skipping`);
      return;
    }

    try {
      const data = await this.mockApi.fetchCompanyData(lead.companyCnpj);

      await this.prisma.$transaction([
        this.prisma.enrichment.create({
          data: {
            leadId,
            companyName: data.companyName,
            tradeName: data.tradeName,
            cnpj: data.cnpj,
            industry: data.industry,
            legalNature: data.legalNature,
            employeeCount: data.employeeCount,
            annualRevenue: data.annualRevenue,
            foundedAt: data.foundedAt ? new Date(data.foundedAt) : null,
            address: (data.address as Prisma.InputJsonValue) ?? undefined,
            cnaes: (data.cnaes as Prisma.InputJsonValue) ?? undefined,
            partners: (data.partners as Prisma.InputJsonValue) ?? undefined,
            phones: (data.phones as Prisma.InputJsonValue) ?? undefined,
            emails: (data.emails as Prisma.InputJsonValue) ?? undefined,
            requestedAt: new Date(requestedAt),
            completedAt: new Date(),
            status: ProcessingStatus.SUCCESS,
          },
        }),
        this.prisma.lead.update({
          where: { id: leadId },
          data: { status: LeadStatus.ENRICHED },
        }),
      ]);

      this.logger.log(`Enrichment completed for lead ${leadId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.$transaction([
        this.prisma.enrichment.create({
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
        `Enrichment failed for lead ${leadId}: ${errorMessage}`,
      );
    }
  }
}
