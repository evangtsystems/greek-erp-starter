CREATE TYPE "StockMovementType" AS ENUM ('OPENING', 'RECEIPT', 'SALE', 'ADJUSTMENT');

CREATE TABLE "stock_movements" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "serial_id" TEXT,
  "type" "StockMovementType" NOT NULL,
  "quantity" DECIMAL(15,4) NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_movements_organization_id_product_id_idx" ON "stock_movements"("organization_id", "product_id");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "stock_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
