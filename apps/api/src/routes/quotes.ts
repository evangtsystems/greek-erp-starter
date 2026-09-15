import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const quoteRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const createQuoteSchema = z.object({
  organizationId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  quoteNumber: z.string().min(1).optional(),
  validUntil: z.string().or(z.date()).optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().uuid().nullable().optional(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    vatRate: z.coerce.number().min(0)
  })).min(1)
});

quoteRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const quotes = await prisma.quote.findMany({
    where: { organizationId: parsed.data.organizationId },
    include: {
      customer: true,
      lines: { include: { product: true } },
      convertedInvoice: { include: { series: true } },
      convertedOrder: true
    },
    orderBy: { createdAt: "desc" }
  });

  res.json(quotes);
});

quoteRouter.post("/", async (req, res) => {
  const parsed = createQuoteSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  try {
    const quoteCount = await prisma.quote.count({
      where: { organizationId: data.organizationId }
    });
    const quoteNumber = data.quoteNumber || `QT-${new Date().getFullYear()}-${String(quoteCount + 1).padStart(4, "0")}`;

    const lines = data.lines.map((l, index) => {
      const net = l.quantity * l.unitPrice;
      const vat = net * (l.vatRate / 100);
      return {
        productId: l.productId ?? null,
        lineNo: index + 1,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        netValue: Number(net.toFixed(2)),
        vatRate: l.vatRate,
        vatAmount: Number(vat.toFixed(2)),
        totalValue: Number((net + vat).toFixed(2))
      };
    });

    const netAmount = lines.reduce((sum, l) => sum + l.netValue, 0);
    const vatAmount = lines.reduce((sum, l) => sum + l.vatAmount, 0);

    const quote = await prisma.quote.create({
      data: {
        organizationId: data.organizationId,
        customerId: data.customerId ?? null,
        quoteNumber,
        status: "DRAFT",
        issueDate: new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // default 30 days
        netAmount,
        vatAmount,
        totalAmount: netAmount + vatAmount,
        notes: data.notes ?? null,
        lines: { create: lines }
      },
      include: { customer: true, lines: true }
    });

    res.status(201).json(quote);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Quote creation failed"
    });
  }
});

quoteRouter.post("/:id/convert-to-invoice", async (req, res) => {
  const quoteId = req.params.id;
  const organizationId = String(req.body.organizationId ?? "");
  const seriesId = req.body.seriesId ? String(req.body.seriesId) : undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, organizationId },
        include: { lines: true, customer: true }
      });

      if (!quote) throw new Error("Quote not found");
      if (quote.status === "CONVERTED") throw new Error("Quote has already been converted to an invoice");

      let targetSeries = seriesId
        ? await tx.invoiceSeries.findFirst({ where: { id: seriesId, organizationId } })
        : await tx.invoiceSeries.findFirst({ where: { organizationId, active: true } });

      if (!targetSeries) throw new Error("No active invoice series available for conversion");

      const invoiceLines = quote.lines.map((l) => ({
        productId: l.productId,
        lineNo: l.lineNo,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: 0,
        netValue: l.netValue,
        vatCategory: "VAT_24",
        vatRate: l.vatRate,
        vatAmount: l.vatAmount,
        classificationType: "E3_561_001",
        classificationCategory: "category1_1",
        totalValue: l.totalValue
      }));

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          customerId: quote.customerId,
          seriesId: targetSeries.id,
          documentType: targetSeries.documentType,
          paymentMethod: "BANK_TRANSFER",
          netAmount: quote.netAmount,
          vatAmount: quote.vatAmount,
          totalAmount: quote.totalAmount,
          status: "DRAFT",
          lines: { create: invoiceLines }
        },
        include: { lines: true, series: true, customer: true }
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: "CONVERTED",
          convertedInvoiceId: invoice.id
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          entityType: "quote",
          entityId: quote.id,
          action: "CONVERT_TO_INVOICE",
          newData: JSON.parse(JSON.stringify({
            invoiceId: invoice.id,
            quoteNumber: quote.quoteNumber
          }))
        }
      });

      return invoice;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Conversion failed"
    });
  }
});

quoteRouter.post("/:id/convert-to-order", async (req, res) => {
  const quoteId = req.params.id;
  const organizationId = String(req.body.organizationId ?? "");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, organizationId },
        include: { lines: true, customer: true }
      });

      if (!quote) throw new Error("Quote not found");

      const orderCount = await tx.salesOrder.count({ where: { organizationId } });
      const orderNumber = `SO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, "0")}`;

      const orderLines = quote.lines.map((l) => ({
        productId: l.productId,
        lineNo: l.lineNo,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        netValue: l.netValue,
        vatRate: l.vatRate,
        vatAmount: l.vatAmount,
        totalValue: l.totalValue
      }));

      const order = await tx.salesOrder.create({
        data: {
          organizationId,
          customerId: quote.customerId,
          orderNumber,
          status: "CONFIRMED",
          orderDate: new Date(),
          netAmount: quote.netAmount,
          vatAmount: quote.vatAmount,
          totalAmount: quote.totalAmount,
          notes: quote.notes ? `Από προσφορά ${quote.quoteNumber}: ${quote.notes}` : `Από προσφορά ${quote.quoteNumber}`,
          lines: { create: orderLines }
        },
        include: { lines: true, customer: true }
      });

      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: "ACCEPTED",
          convertedOrderId: order.id
        }
      });

      return order;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Order creation failed"
    });
  }
});
