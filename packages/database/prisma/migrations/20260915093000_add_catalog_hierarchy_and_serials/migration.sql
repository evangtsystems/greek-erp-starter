CREATE TYPE "SerialStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'IN_REPAIR');

CREATE TABLE "product_families" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_families_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_categories" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_serials" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "serial_number" TEXT NOT NULL,
  "status" "SerialStatus" NOT NULL DEFAULT 'AVAILABLE',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_serials_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "products" ADD COLUMN "category_id" TEXT, ADD COLUMN "track_serial_numbers" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "product_families_organization_id_name_key" ON "product_families"("organization_id", "name");
CREATE UNIQUE INDEX "product_categories_family_id_name_key" ON "product_categories"("family_id", "name");
CREATE INDEX "product_categories_organization_id_idx" ON "product_categories"("organization_id");
CREATE UNIQUE INDEX "stock_serials_organization_id_serial_number_key" ON "stock_serials"("organization_id", "serial_number");
CREATE INDEX "stock_serials_product_id_status_idx" ON "stock_serials"("product_id", "status");
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

ALTER TABLE "product_families" ADD CONSTRAINT "product_families_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "product_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_serials" ADD CONSTRAINT "stock_serials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_serials" ADD CONSTRAINT "stock_serials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
