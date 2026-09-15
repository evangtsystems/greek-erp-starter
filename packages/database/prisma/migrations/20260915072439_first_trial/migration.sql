/*
  Warnings:

  - You are about to drop the column `provider_billing_book_id` on the `invoice_series` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invoice_series" DROP COLUMN "provider_billing_book_id";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "provider_billing_book_id" TEXT;
