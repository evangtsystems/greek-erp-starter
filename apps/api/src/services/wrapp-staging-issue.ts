import crypto from "node:crypto";
import { prisma } from "../../../../packages/database/src/client.js";

const paymentMethodType = { CASH: 1, BANK_TRANSFER: 2, CARD: 3, IRIS: 8, OTHER: 1 } as const;
const baseUrl = () => (process.env.WRAPP_BASE_URL ?? "https://staging.wrapp.ai/api/v1").replace(/\/$/, "");

export async function issueWrappStagingInvoice(organizationId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId }, include: { customer: true, series: true, lines: true } });
  if (!invoice) throw new Error("Invoice not found");
  if (!invoice.series.providerBillingBookId) throw new Error("Invoice series is not mapped to a Wrapp billing book");
  if (!invoice.customer) throw new Error("Customer is required");
  if (!["DRAFT", "READY", "FAILED"].includes(invoice.status)) throw new Error(`Invoice cannot be issued from ${invoice.status}`);

  const assigned = await prisma.$transaction(async (tx) => {
    const current = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!current || !["DRAFT", "READY", "FAILED"].includes(current.status)) throw new Error("Invoice is no longer ready");
    let number = current.invoiceNumber;
    if (!number) {
      const rows = await tx.$queryRaw<Array<{ next_number: number }>>`UPDATE invoice_series SET next_number = next_number + 1, updated_at = NOW() WHERE id = ${current.seriesId} AND organization_id = ${organizationId} RETURNING next_number`;
      if (rows.length !== 1) throw new Error("Invoice series not found");
      number = rows[0].next_number - 1;
    }
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { invoiceNumber: number, issueDate: current.issueDate ?? new Date(), status: "SUBMITTING", providerStatus: "SUBMITTING" } });
    await tx.providerTransmission.create({ data: { organizationId, invoiceId, provider: "WRAPP_STAGING", idempotencyKey: crypto.randomUUID(), operation: "ISSUE_INVOICE", status: "PROCESSING", requestPayload: { invoiceId } } });
    return updated;
  });

  const email = process.env.WRAPP_STAGING_TENANT_EMAIL;
  const apiKey = process.env.WRAPP_STAGING_TENANT_API_KEY;
  if (!email || !apiKey) throw new Error("Wrapp staging credentials are not configured");
  try {
    const login = await fetch(`${baseUrl()}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, api_key: apiKey }) });
    const loginBody = await login.json().catch(() => null);
    const jwt = loginBody?.data?.attributes?.jwt;
    if (!login.ok || typeof jwt !== "string") throw new Error("Wrapp staging login failed");
    const body = { invoice_type_code: invoice.documentType, billing_book_id: invoice.series.providerBillingBookId, payment_method_type: paymentMethodType[invoice.paymentMethod], net_total_amount: Number(invoice.netAmount), vat_total_amount: Number(invoice.vatAmount), total_amount: Number(invoice.totalAmount), payable_total_amount: Number(invoice.totalAmount), counterpart: { name: invoice.customer.name, country_code: invoice.customer.country, ...(invoice.customer.vatNumber ? { vat: invoice.customer.vatNumber } : {}), city: invoice.customer.city, street: invoice.customer.address, postal_code: invoice.customer.postalCode }, invoice_lines: invoice.lines.map(l => ({ line_number: l.lineNo, name: l.description, quantity: Number(l.quantity), quantity_type: 1, unit_price: Number(l.unitPrice), net_total_price: Number(l.netValue), vat_rate: Number(l.vatRate), vat_total: Number(l.vatAmount), subtotal: Number(l.totalValue), classification_category: l.classificationCategory, classification_type: l.classificationType })) };
    const response = await fetch(`${baseUrl()}/invoices`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` }, body: JSON.stringify(body) });
    const provider = await response.json().catch(() => null);
    if (!response.ok) throw new Error("Wrapp staging invoice failed");
    const result = await prisma.$transaction(async tx => {
      const issued = await tx.invoice.update({ where: { id: invoiceId }, data: { status: "ISSUED", providerStatus: "ISSUED", providerDocumentId: provider.id ?? null, mydataMark: provider.my_data_mark ?? null, mydataUid: provider.my_data_uid ?? null, qrUrl: provider.my_data_qr_url ?? provider.wrapp_invoice_url ?? null, issuedAt: new Date() } });
      await tx.providerTransmission.updateMany({ where: { invoiceId, provider: "WRAPP_STAGING", status: "PROCESSING" }, data: { status: "SUCCESS", responsePayload: provider, completedAt: new Date() } });
      return issued;
    });
    return { invoice: result, provider };
  } catch (error) {
    await prisma.$transaction(async tx => { await tx.invoice.update({ where: { id: invoiceId }, data: { status: "FAILED", providerStatus: "FAILED" } }); await tx.providerTransmission.updateMany({ where: { invoiceId, provider: "WRAPP_STAGING", status: "PROCESSING" }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Unknown error", completedAt: new Date() } }); });
    throw error;
  }
}
