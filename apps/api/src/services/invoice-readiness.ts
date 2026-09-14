import type { Invoice, InvoiceLine, InvoiceSeries, Organization, Customer } from "@prisma/client";
import type { CoreInvoice } from "../../../../packages/providers/src/types.js";

type InvoiceForReadiness = Invoice & {
  organization: Organization;
  customer: Customer | null;
  series: InvoiceSeries;
  lines: InvoiceLine[];
};

export type ReadinessResult = {
  ready: boolean;
  errors: string[];
  warnings: string[];
};

export function validateInvoiceReadiness(invoice: InvoiceForReadiness): ReadinessResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!invoice.organization.vatNumber) errors.push("Issuer VAT number is required");
  if (!invoice.organization.address) errors.push("Issuer address is required");
  if (!invoice.organization.city) errors.push("Issuer city is required");
  if (!invoice.organization.postalCode) errors.push("Issuer postal code is required");
  if (!invoice.customer) errors.push("Customer is required for provider issuing");
  if (invoice.customer?.type === "BUSINESS" && !invoice.customer.vatNumber) {
    errors.push("Business customer VAT number is required");
  }
  if (!invoice.series.code) errors.push("Invoice series code is required");
  if (!invoice.documentType) errors.push("Document type is required");
  if (invoice.lines.length === 0) errors.push("At least one invoice line is required");
  if (Number(invoice.totalAmount) <= 0) errors.push("Invoice total must be greater than zero");

  for (const line of invoice.lines) {
    if (Number(line.quantity) <= 0) errors.push(`Line ${line.lineNo}: quantity must be greater than zero`);
    if (Number(line.netValue) < 0) errors.push(`Line ${line.lineNo}: net value cannot be negative`);
    if (!line.vatCategory) warnings.push(`Line ${line.lineNo}: VAT category is not set yet`);
    if (!line.classificationType) warnings.push(`Line ${line.lineNo}: income classification type is not set yet`);
    if (!line.classificationCategory) {
      warnings.push(`Line ${line.lineNo}: income classification category is not set yet`);
    }
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings
  };
}

export function toCoreInvoice(invoice: InvoiceForReadiness): CoreInvoice {
  return {
    id: invoice.id,
    organizationId: invoice.organizationId,
    customerId: invoice.customerId,
    seriesCode: invoice.series.code,
    invoiceNumber: invoice.invoiceNumber,
    documentType: invoice.documentType,
    issueDate: invoice.issueDate,
    currency: invoice.currency,
    paymentMethod: invoice.paymentMethod,
    netAmount: invoice.netAmount.toString(),
    vatAmount: invoice.vatAmount.toString(),
    totalAmount: invoice.totalAmount.toString(),
    issuer: {
      name: invoice.organization.name,
      vatNumber: invoice.organization.vatNumber,
      taxOffice: invoice.organization.taxOffice,
      address: invoice.organization.address,
      city: invoice.organization.city,
      postalCode: invoice.organization.postalCode,
      country: invoice.organization.country
    },
    customer: invoice.customer
      ? {
          name: invoice.customer.name,
          vatNumber: invoice.customer.vatNumber,
          taxOffice: invoice.customer.taxOffice,
          address: invoice.customer.address,
          city: invoice.customer.city,
          postalCode: invoice.customer.postalCode,
          country: invoice.customer.country
        }
      : null,
    lines: invoice.lines.map((line) => ({
      lineNo: line.lineNo,
      productId: line.productId,
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discountAmount: line.discountAmount.toString(),
      netValue: line.netValue.toString(),
      vatCategory: line.vatCategory,
      vatRate: line.vatRate.toString(),
      vatAmount: line.vatAmount.toString(),
      classificationType: line.classificationType,
      classificationCategory: line.classificationCategory,
      totalValue: line.totalValue.toString()
    }))
  };
}
