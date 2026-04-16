import { ConflictException } from '@nestjs/common';
import { LeadStatus, Prisma, PrismaClient } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.PENDING]: [LeadStatus.ENRICHING],
  [LeadStatus.ENRICHING]: [LeadStatus.ENRICHED, LeadStatus.FAILED],
  [LeadStatus.ENRICHED]: [LeadStatus.CLASSIFYING, LeadStatus.ENRICHING],
  [LeadStatus.CLASSIFYING]: [LeadStatus.CLASSIFIED, LeadStatus.FAILED],
  [LeadStatus.CLASSIFIED]: [LeadStatus.CLASSIFYING, LeadStatus.ENRICHING],
  [LeadStatus.FAILED]: [LeadStatus.ENRICHING, LeadStatus.CLASSIFYING],
};

const ALLOWED_SOURCES: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.PENDING]: [],
  [LeadStatus.ENRICHING]: [
    LeadStatus.PENDING,
    LeadStatus.ENRICHED,
    LeadStatus.CLASSIFIED,
    LeadStatus.FAILED,
  ],
  [LeadStatus.ENRICHED]: [LeadStatus.ENRICHING],
  [LeadStatus.CLASSIFYING]: [
    LeadStatus.ENRICHED,
    LeadStatus.CLASSIFIED,
    LeadStatus.FAILED,
  ],
  [LeadStatus.CLASSIFIED]: [LeadStatus.CLASSIFYING],
  [LeadStatus.FAILED]: [LeadStatus.ENRICHING, LeadStatus.CLASSIFYING],
};

export function isValidTransition(
  current: LeadStatus,
  next: LeadStatus,
): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}

export function canEnrich(status: LeadStatus): boolean {
  return ALLOWED_TRANSITIONS[status]?.includes(LeadStatus.ENRICHING) ?? false;
}

export function canClassify(status: LeadStatus): boolean {
  return ALLOWED_TRANSITIONS[status]?.includes(LeadStatus.CLASSIFYING) ?? false;
}

type PrismaLike = PrismaClient | Prisma.TransactionClient;

export async function transitionStatus(
  client: PrismaLike,
  leadId: string,
  to: LeadStatus,
): Promise<void> {
  const allowedFrom = ALLOWED_SOURCES[to];
  if (!allowedFrom || allowedFrom.length === 0) {
    throw new ConflictException(
      `No valid source states for transition to ${to}`,
    );
  }
  const result = await client.lead.updateMany({
    where: { id: leadId, status: { in: allowedFrom } },
    data: { status: to },
  });
  if (result.count === 0) {
    throw new ConflictException(
      `Lead ${leadId} cannot transition to ${to} from its current state`,
    );
  }
}
