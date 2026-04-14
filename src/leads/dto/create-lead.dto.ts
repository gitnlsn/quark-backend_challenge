import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNumber,
  IsPositive,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { LeadSource } from '@prisma/client';
import { IsCnpj } from '../../common/validators/cnpj.validator.js';

export class CreateLeadDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'phone must be in E.164 format (e.g., +5511999991111)',
  })
  phone: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  companyName: string;

  @IsCnpj()
  companyCnpj: string;

  @IsOptional()
  @IsUrl()
  companyWebsite?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  estimatedValue?: number;

  @IsEnum(LeadSource)
  source: LeadSource;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
