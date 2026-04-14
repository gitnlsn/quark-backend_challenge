import express from 'express';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const FAILURE_RATE = parseFloat(process.env.FAILURE_RATE || '0.1');

// Simple seeded hash from CNPJ to generate deterministic but varied data
function hashCnpj(cnpj: string): number {
  let hash = 0;
  for (let i = 0; i < cnpj.length; i++) {
    hash = (hash * 31 + cnpj.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

function pick<T>(arr: T[], hash: number): T {
  return arr[hash % arr.length];
}

const INDUSTRIES = [
  'SaaS', 'Fintech', 'E-commerce', 'Healthtech', 'Edtech',
  'Agritech', 'Logistics', 'Consulting', 'Manufacturing', 'Retail',
];

const LEGAL_NATURES = [
  'Sociedade Empresária Limitada',
  'Sociedade Anônima',
  'Empresa Individual de Responsabilidade Limitada',
  'Microempreendedor Individual',
  'Sociedade Simples',
];

const CITIES = [
  { city: 'São Paulo', state: 'SP', zipCode: '01001-000' },
  { city: 'Rio de Janeiro', state: 'RJ', zipCode: '20040-020' },
  { city: 'Belo Horizonte', state: 'MG', zipCode: '30130-000' },
  { city: 'Curitiba', state: 'PR', zipCode: '80010-000' },
  { city: 'Porto Alegre', state: 'RS', zipCode: '90010-000' },
  { city: 'Recife', state: 'PE', zipCode: '50010-000' },
  { city: 'Florianópolis', state: 'SC', zipCode: '88010-000' },
];

const FIRST_NAMES = ['Ana', 'Carlos', 'Maria', 'João', 'Pedro', 'Juliana', 'Lucas', 'Fernanda'];
const LAST_NAMES = ['Souza', 'Lima', 'Santos', 'Oliveira', 'Silva', 'Costa', 'Pereira', 'Almeida'];

const CNAES = [
  { code: '6201-5/00', description: 'Desenvolvimento de programas de computador sob encomenda' },
  { code: '6202-3/00', description: 'Desenvolvimento e licenciamento de programas de computador customizáveis' },
  { code: '6203-1/00', description: 'Desenvolvimento e licenciamento de programas de computador não-customizáveis' },
  { code: '6204-0/00', description: 'Consultoria em tecnologia da informação' },
  { code: '6209-1/00', description: 'Suporte técnico, manutenção e outros serviços em tecnologia da informação' },
  { code: '6311-9/00', description: 'Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet' },
  { code: '4751-2/01', description: 'Comércio varejista especializado de equipamentos e suprimentos de informática' },
];

function generateCompanyData(cnpj: string) {
  const h = hashCnpj(cnpj);
  const h2 = hashCnpj(cnpj + 'salt');
  const h3 = hashCnpj(cnpj + 'pepper');

  const industry = pick(INDUSTRIES, h);
  const location = pick(CITIES, h2);
  const employeeCount = 10 + (h % 500);
  const annualRevenue = 100000 + (h % 10000000);
  const foundedYear = 2000 + (h % 24);

  const partner1First = pick(FIRST_NAMES, h);
  const partner1Last = pick(LAST_NAMES, h2);
  const partner2First = pick(FIRST_NAMES, h3);
  const partner2Last = pick(LAST_NAMES, h);

  const primaryCnae = pick(CNAES, h);
  const secondaryCnae = pick(CNAES.filter(c => c.code !== primaryCnae.code), h2);

  const companyName = `${pick(LAST_NAMES, h)} ${industry} Corp`;
  const tradeName = `${companyName} Soluções`;
  const domain = companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '') + '.com.br';

  return {
    companyName,
    tradeName,
    cnpj,
    industry,
    legalNature: pick(LEGAL_NATURES, h),
    employeeCount,
    annualRevenue,
    foundedAt: `${foundedYear}-${String((h % 12) + 1).padStart(2, '0')}-${String((h % 28) + 1).padStart(2, '0')}`,
    address: {
      street: `Rua das ${pick(['Inovações', 'Flores', 'Palmeiras', 'Américas', 'Indústrias'], h)}`,
      number: String(100 + (h % 900)),
      complement: h % 3 === 0 ? `Sala ${10 + (h % 90)}` : null,
      neighborhood: pick(['Centro', 'Jardins', 'Vila Mariana', 'Boa Vista', 'Alphaville'], h2),
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
      country: 'BR',
    },
    cnaes: [
      { ...primaryCnae, isPrimary: true },
      { ...secondaryCnae, isPrimary: false },
    ],
    partners: [
      {
        name: `${partner1First} ${partner1Last}`,
        cpf: `***.${String(100 + (h % 900))}.${String(100 + (h2 % 900))}-**`,
        role: 'Sócio Administrador',
        joinedAt: `${foundedYear}-${String((h % 12) + 1).padStart(2, '0')}-${String((h % 28) + 1).padStart(2, '0')}`,
        phone: `+55 11 ${String(90000 + (h % 10000))}-${String(1000 + (h2 % 9000))}`,
        email: `${partner1First.toLowerCase()}.${partner1Last.toLowerCase()}@${domain}`,
      },
      {
        name: `${partner2First} ${partner2Last}`,
        cpf: `***.${String(100 + (h3 % 900))}.${String(100 + (h % 900))}-**`,
        role: 'Sócio',
        joinedAt: `${foundedYear + 2}-${String((h2 % 12) + 1).padStart(2, '0')}-${String((h2 % 28) + 1).padStart(2, '0')}`,
        phone: `+55 11 ${String(90000 + (h2 % 10000))}-${String(1000 + (h3 % 9000))}`,
        email: `${partner2First.toLowerCase()}.${partner2Last.toLowerCase()}@${domain}`,
      },
    ],
    phones: [
      { type: 'commercial', number: `+55 11 ${String(3000 + (h % 1000))}-${String(1000 + (h % 9000))}` },
      { type: 'mobile', number: `+55 11 ${String(90000 + (h2 % 10000))}-${String(1000 + (h3 % 9000))}` },
    ],
    emails: [
      { type: 'commercial', address: `contato@${domain}` },
      { type: 'financial', address: `financeiro@${domain}` },
    ],
  };
}

app.get('/api/companies/:cnpj', (req, res) => {
  const { cnpj } = req.params;
  const cleaned = cnpj.replace(/\D/g, '');

  if (cleaned.length !== 14) {
    return res.status(400).json({ error: 'Invalid CNPJ format. Expected 14 digits.' });
  }

  // Simulate random failures
  if (Math.random() < FAILURE_RATE) {
    return res.status(500).json({ error: 'Internal server error - service temporarily unavailable' });
  }

  const data = generateCompanyData(cleaned);
  return res.json(data);
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Mock Enrichment API running on port ${PORT}`);
});
