import { LeadStatus } from '@prisma/client';

const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.PENDING]: [LeadStatus.ENRICHING],
  [LeadStatus.ENRICHING]: [LeadStatus.ENRICHED, LeadStatus.FAILED],
  [LeadStatus.ENRICHED]: [LeadStatus.CLASSIFYING, LeadStatus.ENRICHING],
  [LeadStatus.CLASSIFYING]: [LeadStatus.CLASSIFIED, LeadStatus.FAILED],
  [LeadStatus.CLASSIFIED]: [LeadStatus.CLASSIFYING, LeadStatus.ENRICHING],
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
