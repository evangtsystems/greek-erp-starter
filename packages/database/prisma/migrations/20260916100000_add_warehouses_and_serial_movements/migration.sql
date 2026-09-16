CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "warehouses_organization_id_code_key"
ON "warehouses"("organization_id", "code");

CREATE INDEX "warehouses_organization_id_active_idx"
ON "warehouses"("organization_id", "active");

ALTER TABLE "stock_movements" ADD COLUMN "warehouse_id" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "serial_id" TEXT;
ALTER TABLE "stock_serials" ADD COLUMN "warehouse_id" TEXT;

-- Every existing company receives one default warehouse; existing balances and serials remain valid.
INSERT INTO "warehouses" ("id", "organization_id", "code", "name", "active", "updated_at")
SELECT 'default-' || "id", "id", 'MAIN', 'Κεντρική αποθήκη', true, CURRENT_TIMESTAMP
FROM "organizations";

UPDATE "stock_movements"
SET "warehouse_id" = 'default-' || "organization_id"
WHERE "warehouse_id" IS NULL;

UPDATE "stock_serials"
SET "warehouse_id" = 'default-' || "organization_id"
WHERE "warehouse_id" IS NULL;

ALTER TABLE "stock_movements" ALTER COLUMN "warehouse_id" SET NOT NULL;
ALTER TABLE "stock_serials" ALTER COLUMN "warehouse_id" SET NOT NULL;

CREATE INDEX "stock_movements_warehouse_id_product_id_idx"
ON "stock_movements"("warehouse_id", "product_id");

CREATE INDEX "stock_movements_serial_id_idx"
ON "stock_movements"("serial_id");

CREATE INDEX "stock_serials_warehouse_id_status_idx"
ON "stock_serials"("warehouse_id", "status");

ALTER TABLE "warehouses"
ADD CONSTRAINT "warehouses_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_warehouse_id_fkey"
FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
ADD CONSTRAINT "stock_movements_serial_id_fkey"
FOREIGN KEY ("serial_id") REFERENCES "stock_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_serials"
ADD CONSTRAINT "stock_serials_warehouse_id_fkey"
FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
