import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  IsArray,
  IsUUID,
} from 'class-validator';
import { LeadSource, LeadStatus } from '@prisma/client';

export class LeadQueryDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ids?: string[];

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
