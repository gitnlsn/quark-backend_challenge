import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { LeadsModule } from './leads/leads.module.js';
import { EnrichmentModule } from './enrichment/enrichment.module.js';
import { ClassificationModule } from './classification/classification.module.js';
import { ExportModule } from './export/export.module.js';
import { QueueModule } from './queue/queue.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    LeadsModule,
    EnrichmentModule,
    ClassificationModule,
    ExportModule,
  ],
})
export class AppModule {}
