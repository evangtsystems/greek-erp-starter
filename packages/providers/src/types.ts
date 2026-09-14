export type ProviderIssueResult = {
  providerDocumentId: string;
  providerStatus: string;
  mark?: string;
  uid?: string;
  qrUrl?: string;
  raw?: unknown;
};

export type CoreInvoiceLine = {
  lineNo: number;
  productId?: string | null;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  discountAmount: string | number;
  netValue: string | number;
  vatCategory?: string | null;
  vatRate: string | number;
  vatAmount: string | number;
  classificationType?: string | null;
  classificationCategory?: string | null;
  totalValue: string | number;
};

export type CoreInvoice = {
  id: string;
  organizationId: string;
  customerId?: string | null;
  seriesCode: string;
  invoiceNumber?: number | null;
  documentType: string;
  issueDate?: Date | string | null;
  currency: string;
  paymentMethod: string;
  netAmount: string | number;
  vatAmount: string | number;
  totalAmount: string | number;
  issuer: {
    name: string;
    vatNumber?: string | null;
    taxOffice?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country: string;
  };
  customer?: {
    name: string;
    vatNumber?: string | null;
    taxOffice?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country: string;
  } | null;
  lines: CoreInvoiceLine[];
};

export type ProviderCancelResult = {
  providerStatus: string;
  raw?: unknown;
};

export interface EInvoiceProvider {
  issueInvoice(invoice: unknown, idempotencyKey: string): Promise<ProviderIssueResult>;
  cancelInvoice(invoice: unknown, idempotencyKey: string): Promise<ProviderCancelResult>;
  getInvoiceStatus(providerDocumentId: string): Promise<string>;
}
