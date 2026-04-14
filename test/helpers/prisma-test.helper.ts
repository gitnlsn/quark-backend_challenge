import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://leads:leads123@localhost:5433/leads_db';

// Valid CNPJs for test data (pre-computed to pass validation if needed)
const VALID_CNPJS = [
  '11222333000181',
  '12345678000195',
  '98765432000110',
  '45678912000134',
  '56789123000156',
  '33000167000101',
  '61198164000160',
  '04252011000110',
  '07526557000100',
  '60701190000104',
];

let cnpjCounter = 0;

export async function createTestPrisma(): Promise<PrismaService> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const prisma = new PrismaService();
  await prisma.$connect();
  return prisma;
}

export async function isTestDbAvailable(): Promise<boolean> {
  try {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    const prisma = new PrismaService();
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return true;
  } catch {
    console.warn(
      `Test database is not reachable at ${TEST_DATABASE_URL} — skipping integration tests`,
    );
    return false;
  }
}

/**
 * Generate a unique lead data object for each test invocation.
 * Uses a random suffix so tests never collide on email or CNPJ.
 */
export function uniqueLead(overrides: Record<string, unknown> = {}) {
  const id = randomUUID().slice(0, 8);
  const cnpj = VALID_CNPJS[cnpjCounter++ % VALID_CNPJS.length];
  // Append random digits to make CNPJ unique per call (DB stores as varchar)
  const uniqueCnpj = `${cnpj.slice(0, 8)}${id.replace(/[^0-9]/g, '').padEnd(6, '0').slice(0, 6)}`;

  return {
    fullName: `Test User ${id}`,
    email: `test-${id}@example.com`,
    phone: `+5511999${id.replace(/[^0-9]/g, '').padEnd(6, '0').slice(0, 6)}`,
    companyName: `Company ${id}`,
    companyCnpj: uniqueCnpj,
    source: 'WEBSITE' as const,
    ...overrides,
  };
}
