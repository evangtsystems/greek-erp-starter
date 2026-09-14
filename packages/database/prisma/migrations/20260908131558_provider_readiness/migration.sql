-- CreateEnum
CREATE TYPE "ProviderEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'IRIS', 'OTHER');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "payment_method" "PaymentMethodType" NOT NULL DEFAULT 'BANK_TRANSFER',
ADD COLUMN     "payment_status" TEXT NOT NULL DEFAULT 'UNPAID';

-- CreateTable
CREATE TABLE "provider_credentials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" "ProviderEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_credentials_organization_id_enabled_idx" ON "provider_credentials"("organization_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "provider_credentials_organization_id_provider_environment_key" ON "provider_credentials"("organization_id", "provider", "environment");

-- AddForeignKey
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
