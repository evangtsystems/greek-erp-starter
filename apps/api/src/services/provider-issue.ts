import crypto from "node:crypto";
import { prisma } from "../../../../packages/database/src/client.js";
import { toCoreInvoice, validateInvoiceReadiness } from "./invoice-readiness.js";

type IssueProviderInvoiceInput = {
  organizationId: string;
  invoiceId: string;
  provider?: string;
};

export async function issueInvoiceWithProvider(input: IssueProviderInvoiceInput) {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, organizationId: input.organizationId },
      include: { organization: true, customer: true, series: true, lines: true }
    });

    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "DRAFT" && invoice.status !== "READY" && invoice.status !== "FAILED") {
      throw new Error(`Invoice cannot be sent to provider from ${invoice.status}`);
    }

    const readiness = validateInvoiceReadiness(invoice);
    if (!readiness.ready) {
      return {
        accepted: false,
        readiness,
        invoice,
        transmission: null
      };
    }

    const credential = await tx.providerCredential.findFirst({
      where: {
        organizationId: input.organizationId,
        enabled: true,
        provider: input.provider || undefined
      },
      orderBy: { createdAt: "desc" }
    });

    if (!credential) {
      throw new Error("No enabled provider credentials found for this organization");
    }

    let assignedNumber = invoice.invoiceNumber;
    if (!assignedNumber) {
      const updatedSeries = await tx.$queryRaw<Array<{ next_number: number }>>`
        UPDATE invoice_series
        SET next_number = next_number + 1,
            updated_at = NOW()
        WHERE id = ${invoice.seriesId}
          AND organization_id = ${input.organizationId}
        RETURNING next_number
      `;

      if (updatedSeries.length !== 1) throw new Error("Invoice series not found");
      assignedNumber = updatedSeries[0].next_number - 1;
    }

    const submittingInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        invoiceNumber: assignedNumber,
        issueDate: invoice.issueDate ?? new Date(),
        status: "SUBMITTING",
        providerStatus: "QUEUED"
      },
      include: { organization: true, customer: true, series: true, lines: true }
    });

    const coreInvoice = toCoreInvoice(submittingInvoice);
    const idempotencyKey = [
      "issue",
      input.organizationId,
      input.invoiceId,
      credential.provider,
      assignedNumber
    ].join(":");

    const requestPayload = {
      provider: credential.provider,
      environment: credential.environment,
      invoice: coreInvoice
    };

    const transmission = await tx.providerTransmission.upsert({
      where: {
        idempotencyKey_attempt: {
          idempotencyKey,
          attempt: 1
        }
      },
      create: {
        organizationId: input.organizationId,
        invoiceId: input.invoiceId,
        provider: credential.provider,
        idempotencyKey,
        operation: "ISSUE_INVOICE",
        status: "PENDING",
        requestId: crypto.randomUUID(),
        requestPayload
      },
      update: {
        requestPayload
      }
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        entityType: "invoice",
        entityId: invoice.id,
        action: "QUEUE_PROVIDER_ISSUE",
        newData: {
          provider: credential.provider,
          series: submittingInvoice.series.code,
          number: assignedNumber,
          transmissionId: transmission.id
        }
      }
    });

    return {
      accepted: true,
      readiness,
      invoice: submittingInvoice,
      transmission
    };
  });
}
