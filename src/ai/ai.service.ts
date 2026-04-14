import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Lead, Enrichment } from '@prisma/client';

export interface ClassificationResult {
  score: number;
  classification: 'Hot' | 'Warm' | 'Cold';
  justification: string;
  commercialPotential: 'High' | 'Medium' | 'Low';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.ollamaUrl = config.get<string>('OLLAMA_URL', 'http://localhost:11434');
    this.model = config.get<string>('OLLAMA_MODEL', 'tinyllama');
  }

  buildPrompt(lead: Lead, enrichment: Enrichment | null): string {
    let enrichmentBlock = '';
    if (enrichment) {
      enrichmentBlock = `
Enrichment Data:
- Industry: ${enrichment.industry ?? 'N/A'}
- Employees: ${enrichment.employeeCount ?? 'N/A'}
- Annual Revenue: ${enrichment.annualRevenue?.toString() ?? 'N/A'}
- Legal Nature: ${enrichment.legalNature ?? 'N/A'}
- Founded: ${enrichment.foundedAt?.toISOString() ?? 'N/A'}`;
    }

    return `You are a lead scoring assistant. Analyze the following commercial lead and provide a classification.

Lead Information:
- Name: ${lead.fullName}
- Company: ${lead.companyName}
- Estimated Value: ${lead.estimatedValue?.toString() ?? 'Not provided'}
- Source: ${lead.source}
- Website: ${lead.companyWebsite ?? 'Not provided'}
${enrichmentBlock}

Respond in exactly this JSON format, with no additional text:
{
  "score": <number between 0 and 100>,
  "classification": "<Hot|Warm|Cold>",
  "justification": "<brief justification in 1-2 sentences>",
  "commercialPotential": "<High|Medium|Low>"
}`;
  }

  parseResponse(responseText: string): ClassificationResult {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      score: unknown;
      classification: unknown;
      justification: unknown;
      commercialPotential: unknown;
    };

    const score = Number(parsed.score);
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error(`Invalid score: ${String(parsed.score)}`);
    }

    const validClassifications = ['Hot', 'Warm', 'Cold'];
    const raw = String(parsed.classification);
    const classification = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if (!validClassifications.includes(classification)) {
      throw new Error(`Invalid classification: ${classification}`);
    }

    const validPotentials = ['High', 'Medium', 'Low'];
    const rawPotential = String(parsed.commercialPotential);
    const commercialPotential = rawPotential.charAt(0).toUpperCase() + rawPotential.slice(1).toLowerCase();
    if (!validPotentials.includes(commercialPotential)) {
      throw new Error(`Invalid commercialPotential: ${commercialPotential}`);
    }

    return {
      score: Math.round(score),
      classification: classification as ClassificationResult['classification'],
      justification:
        typeof parsed.justification === 'string' ? parsed.justification : '',
      commercialPotential:
        commercialPotential as ClassificationResult['commercialPotential'],
    };
  }

  async classify(
    lead: Lead,
    enrichment: Enrichment | null,
  ): Promise<ClassificationResult & { modelUsed: string }> {
    const prompt = this.buildPrompt(lead, enrichment);
    this.logger.log(`Classifying lead ${lead.id} with model ${this.model}`);

    const maxAttempts = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
        },
        { timeout: 120000 },
      );

      try {
        const result = this.parseResponse(
          (response.data as { response: string }).response,
        );
        return { ...result, modelUsed: `${this.model}:latest` };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `Attempt ${attempt}/${maxAttempts} failed to parse response: ${lastError.message}`,
        );
      }
    }

    throw lastError;
  }
}
