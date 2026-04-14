import { Controller, Post, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { EnrichmentService } from './enrichment.service.js';

@Controller('leads')
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Post(':id/enrichment')
  requestEnrichment(@Param('id', ParseUUIDPipe) id: string) {
    return this.enrichmentService.requestEnrichment(id);
  }

  @Get(':id/enrichments')
  getEnrichmentHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.enrichmentService.getEnrichmentHistory(id);
  }
}
