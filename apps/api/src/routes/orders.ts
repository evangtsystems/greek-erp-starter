import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const orderRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const createOrderSchema = z.object({
  organizationId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  orderNumber: z.string().min(1).optional(),
  expectedDeliveryDate: z.string().or(z.date()).optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().uuid().nullable().optional(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    vatRate: z.coerce.number().min(0)
  })).min(1)
});

orderRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const orders = await prisma.salesOrder.findMany({
    where: { organizationId: parsed.data.organizationId },
    include: {
      customer: true,
      lines: { include: { product: true } },
      invoicedInvoice: { include: { series: true } },
      sourceQuote: true
    },
    orderBy: { createdAt: "desc" }
  });

  res.json(orders);
});

orderRouter.post("/", async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  try {
    const orderCount = await prisma.salesOrder.count({
      where: { organizationId: data.organizationId }
    });
    const orderNumber = data.orderNumber || `SO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, "0")}`;

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

    const order = await prisma.salesOrder.create({
      data: {
        organizationId: data.organizationId,
        customerId: data.customerId ?? null,
        orderNumber,
        status: "CONFIRMED",
        orderDate: new Date(),
        expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null,
        netAmount,
        vatAmount,
        totalAmount: netAmount + vatAmount,
        notes: data.notes ?? null,
        lines: { create: lines }
      },
      include: { customer: true, lines: true }
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Sales order creation failed"
    });
  }
});

orderRouter.post("/:id/convert-to-invoice", async (req, res) => {
  const orderId = req.params.id;
  const organizationId = String(req.body.organizationId ?? "");
  const seriesId = req.body.seriesId ? String(req.body.seriesId) : undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, organizationId },
        include: { lines: true, customer: true }
      });

      if (!order) throw new Error("Sales order not found");
      if (order.status === "INVOICED") throw new Error("Order has already been invoiced");

      let targetSeries = seriesId
        ? await tx.invoiceSeries.findFirst({ where: { id: seriesId, organizationId } })
        : await tx.invoiceSeries.findFirst({ where: { organizationId, active: true } });

      if (!targetSeries) throw new Error("No active invoice series available for conversion");

      const invoiceLines = order.lines.map((l) => ({
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
          customerId: order.customerId,
          seriesId: targetSeries.id,
          documentType: targetSeries.documentType,
          paymentMethod: "BANK_TRANSFER",
          netAmount: order.netAmount,
          vatAmount: order.vatAmount,
          totalAmount: order.totalAmount,
          status: "DRAFT",
          lines: { create: invoiceLines }
        },
        include: { lines: true, series: true, customer: true }
      });

      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: "INVOICED",
          invoicedInvoiceId: invoice.id
        }
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          entityType: "sales_order",
          entityId: order.id,
          action: "CONVERT_TO_INVOICE",
          newData: JSON.parse(JSON.stringify({
            invoiceId: invoice.id,
            orderNumber: order.orderNumber
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

orderRouter.patch("/:id/status", async (req, res) => {
  const orderId = req.params.id;
  const { status, organizationId } = req.body;

  try {
    const updated = await prisma.salesOrder.update({
      where: { id: orderId, organizationId },
      data: { status }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Status update failed"
    });
  }
});
