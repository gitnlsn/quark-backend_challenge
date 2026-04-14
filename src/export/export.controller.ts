import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsEnum } from 'class-validator';
import { LeadSource, LeadStatus } from '@prisma/client';
import { ExportService } from './export.service.js';

export class ExportQueryDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;
}

@Controller('leads')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('export')
  exportLeads(@Query() query: ExportQueryDto) {
    return this.exportService.exportLeads(query);
  }
}
