import { IsOptional, IsEnum } from 'class-validator';
import { LeadSource, LeadStatus } from '@prisma/client';

export class ExportQueryDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;
}
