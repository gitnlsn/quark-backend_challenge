import { PrismaClient, LeadSource } from '@prisma/client';

const prisma = new PrismaClient();

const leads = [
  {
    fullName: 'Ana Souza',
    email: 'ana.souza@techcorp.com.br',
    phone: '+5511999991111',
    companyName: 'Tech Corp Soluções',
    companyCnpj: '11222333000181',
    companyWebsite: 'https://techcorp.com.br',
    estimatedValue: 250000.00,
    source: LeadSource.WEBSITE,
    notes: 'Interesse em plataforma SaaS para gestão de equipes',
  },
  {
    fullName: 'Carlos Lima',
    email: 'carlos.lima@inovatech.com.br',
    phone: '+5521988882222',
    companyName: 'InovaTech Sistemas',
    companyCnpj: '12345678000195',
    companyWebsite: 'https://inovatech.com.br',
    estimatedValue: 500000.00,
    source: LeadSource.REFERRAL,
    notes: 'Indicação do diretor de vendas, reunião agendada',
  },
  {
    fullName: 'Maria Santos',
    email: 'maria.santos@dataflow.io',
    phone: '+5531977773333',
    companyName: 'DataFlow Analytics',
    companyCnpj: '98765432000110',
    estimatedValue: 120000.50,
    source: LeadSource.PAID_ADS,
  },
  {
    fullName: 'Pedro Oliveira',
    email: 'pedro@greenlogistics.com.br',
    phone: '+5541966664444',
    companyName: 'Green Logistics',
    companyCnpj: '45678912000134',
    companyWebsite: 'https://greenlogistics.com.br',
    source: LeadSource.ORGANIC,
    notes: 'Procurando solução de rastreamento de frotas',
  },
  {
    fullName: 'Juliana Pereira',
    email: 'juliana@educamais.com.br',
    phone: '+5511955555555',
    companyName: 'EducaMais Plataforma',
    companyCnpj: '56789123000156',
    estimatedValue: 75000.00,
    source: LeadSource.OTHER,
  },
];

async function main() {
  console.log('Seeding database...');

  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { email: lead.email },
      update: {},
      create: lead,
    });
  }

  console.log(`Seeded ${leads.length} leads`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
