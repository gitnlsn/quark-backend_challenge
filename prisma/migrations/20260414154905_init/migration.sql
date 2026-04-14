-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'REFERRAL', 'PAID_ADS', 'ORGANIC', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'ENRICHING', 'ENRICHED', 'CLASSIFYING', 'CLASSIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('Hot', 'Warm', 'Cold');

-- CreateEnum
CREATE TYPE "CommercialPotential" AS ENUM ('High', 'Medium', 'Low');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "companyName" VARCHAR(150) NOT NULL,
    "companyCnpj" VARCHAR(14) NOT NULL,
    "companyWebsite" TEXT,
    "estimatedValue" DECIMAL(15,2),
    "source" "LeadSource" NOT NULL,
    "notes" VARCHAR(500),
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichments" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "companyName" TEXT,
    "tradeName" TEXT,
    "cnpj" TEXT,
    "industry" TEXT,
    "legalNature" TEXT,
    "employeeCount" INTEGER,
    "annualRevenue" DECIMAL(15,2),
    "foundedAt" TIMESTAMP(3),
    "address" JSONB,
    "cnaes" JSONB,
    "partners" JSONB,
    "phones" JSONB,
    "emails" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "ProcessingStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_classifications" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" INTEGER,
    "classification" "Classification",
    "justification" TEXT,
    "commercialPotential" "CommercialPotential",
    "modelUsed" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "ProcessingStatus" NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_key" ON "leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_companyCnpj_key" ON "leads"("companyCnpj");

-- CreateIndex
CREATE INDEX "enrichments_leadId_idx" ON "enrichments"("leadId");

-- CreateIndex
CREATE INDEX "ai_classifications_leadId_idx" ON "ai_classifications"("leadId");

-- AddForeignKey
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_classifications" ADD CONSTRAINT "ai_classifications_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
