-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "cancel_reason" TEXT,
ADD COLUMN "credited_invoice_id" TEXT;

-- CreateIndex
CREATE INDEX "invoices_credited_invoice_id_idx" ON "invoices"("credited_invoice_id");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credited_invoice_id_fkey" FOREIGN KEY ("credited_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
