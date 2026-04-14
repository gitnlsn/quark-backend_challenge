import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface EnrichmentData {
  companyName: string;
  tradeName: string;
  cnpj: string;
  industry: string;
  legalNature: string;
  employeeCount: number;
  annualRevenue: number;
  foundedAt: string;
  address: Record<string, unknown>;
  cnaes: Record<string, unknown>[];
  partners: Record<string, unknown>[];
  phones: Record<string, unknown>[];
  emails: Record<string, unknown>[];
}

@Injectable()
export class MockApiClientService {
  private readonly logger = new Logger(MockApiClientService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('MOCK_API_URL', 'http://localhost:3001');
  }

  async fetchCompanyData(cnpj: string): Promise<EnrichmentData> {
    const url = `${this.baseUrl}/api/companies/${cnpj}`;
    this.logger.log(`Fetching enrichment data for CNPJ: ${cnpj}`);
    const response = await axios.get<EnrichmentData>(url, { timeout: 10000 });
    return response.data;
  }
}
