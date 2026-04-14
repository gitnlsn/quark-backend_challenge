import { Module } from '@nestjs/common';
import { EnrichmentController } from './enrichment.controller.js';
import { EnrichmentService } from './enrichment.service.js';
import { EnrichmentWorker } from './enrichment.worker.js';
import { MockApiClientModule } from '../mock-api-client/mock-api-client.module.js';

@Module({
  imports: [MockApiClientModule],
  controllers: [EnrichmentController],
  providers: [EnrichmentService, EnrichmentWorker],
})
export class EnrichmentModule {}
