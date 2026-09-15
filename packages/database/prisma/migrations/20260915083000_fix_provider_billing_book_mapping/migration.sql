ALTER TABLE "invoice_series"
ADD COLUMN IF NOT EXISTS "provider_billing_book_id" TEXT;
