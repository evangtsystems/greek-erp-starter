import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { validateInvoiceReadiness } from "../services/invoice-readiness.js";
import { issueInvoiceWithProvider } from "../services/provider-issue.js";

export const invoiceRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const draftInvoiceSchema = z.object({
  organizationId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  seriesId: z.string().uuid(),
  documentType: z.string().min(1),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "IRIS", "OTHER"]).default("BANK_TRANSFER"),
  lines: z.array(z.object({
    productId: z.string().uuid().nullable().optional(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    vatCategory: z.string().min(1).nullable().optional(),
    vatRate: z.coerce.number().min(0),
    classificationType: z.string().min(1).nullable().optional(),
    classificationCategory: z.string().min(1).nullable().optional()
  })).min(1)
});

const providerIssueSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.string().min(1).optional()
});

invoiceRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: parsed.data.organizationId },
    include: { customer: true, series: true, lines: true },
    orderBy: { createdAt: "desc" }
  });

  res.json(invoices);
});

invoiceRouter.post("/", async (req, res) => {
  const parsed = draftInvoiceSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  const lines = data.lines.map((line, index) => {
    const net = line.quantity * line.unitPrice;
    const vat = net * (line.vatRate / 100);

    return {
      productId: line.productId ?? null,
      lineNo: index + 1,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: 0,
      netValue: Number(net.toFixed(2)),
      vatCategory: line.vatCategory ?? null,
      vatRate: line.vatRate,
      vatAmount: Number(vat.toFixed(2)),
      classificationType: line.classificationType ?? null,
      classificationCategory: line.classificationCategory ?? null,
      totalValue: Number((net + vat).toFixed(2))
    };
  });

  const netAmount = lines.reduce((sum, l) => sum + l.netValue, 0);
  const vatAmount = lines.reduce((sum, l) => sum + l.vatAmount, 0);

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: data.organizationId,
      customerId: data.customerId ?? null,
      seriesId: data.seriesId,
      documentType: data.documentType,
      paymentMethod: data.paymentMethod,
      netAmount,
      vatAmount,
      totalAmount: netAmount + vatAmount,
      lines: { create: lines }
    },
    include: { lines: true }
  });

  res.status(201).json(invoice);
});

invoiceRouter.get("/:id/readiness", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, organizationId: parsed.data.organizationId },
    include: { organization: true, customer: true, series: true, lines: true }
  });

  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  res.json({
    invoiceId: invoice.id,
    status: invoice.status,
    readiness: validateInvoiceReadiness(invoice)
  });
});

invoiceRouter.post("/:id/issue-provider", async (req, res) => {
  const parsed = providerIssueSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await issueInvoiceWithProvider({
      organizationId: parsed.data.organizationId,
      invoiceId: req.params.id,
      provider: parsed.data.provider
    });

    if (!result.accepted) return res.status(422).json(result);

    res.status(202).json({
      ...result,
      message: "Provider transmission queued. Add a concrete EInvoiceProvider adapter to send it."
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

invoiceRouter.post("/:id/issue-local", async (req, res) => {
  const invoiceId = req.params.id;
  const organizationId = String(req.body.organizationId ?? "");

  try {
    const issued = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: { series: true }
      });

      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status !== "DRAFT" && invoice.status !== "READY") {
        throw new Error(`Invoice cannot be issued from ${invoice.status}`);
      }

      // Atomic increment: UPDATE ... RETURNING avoids duplicate numbering
      // when multiple invoices are issued concurrently.
      const updatedSeries = await tx.$queryRaw<
        Array<{ next_number: number }>
      >`
        UPDATE invoice_series
        SET next_number = next_number + 1,
            updated_at = NOW()
        WHERE id = ${invoice.seriesId}
          AND organization_id = ${organizationId}
        RETURNING next_number
      `;

      if (updatedSeries.length !== 1) throw new Error("Invoice series not found");

      const assignedNumber = updatedSeries[0].next_number - 1;

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          invoiceNumber: assignedNumber,
          issueDate: new Date(),
          status: "ISSUED",
          issuedAt: new Date(),
          providerStatus: "LOCAL_ONLY"
        },
        include: { lines: true, customer: true, series: true }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          entityType: "invoice",
          entityId: invoice.id,
          action: "ISSUE_LOCAL",
          newData: JSON.parse(JSON.stringify({
            series: updated.series.code,
            number: assignedNumber,
            totalAmount: updated.totalAmount.toString()
          }))
        }
      });

      return updated;
    });

    res.json(issued);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});
