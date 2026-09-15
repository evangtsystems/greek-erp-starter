-- Preserve the source system's stable customer code for idempotent imports.
ALTER TABLE "customers" ADD COLUMN "external_code" TEXT;

CREATE UNIQUE INDEX "customers_organization_id_external_code_key"
ON "customers"("organization_id", "external_code");
