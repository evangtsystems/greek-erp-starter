import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const invoiceSeriesRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const createInvoiceSeriesSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1),
  documentType: z.string().min(1),
  nextNumber: z.coerce.number().int().positive().default(1),
  active: z.boolean().default(true)
});

invoiceSeriesRouter.post("/", async (req, res) => {
  const parsed = createInvoiceSeriesSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  const series = await prisma.invoiceSeries.create({
    data: {
      organizationId: data.organizationId,
      code: data.code,
      documentType: data.documentType,
      nextNumber: data.nextNumber,
      active: data.active
    }
  });

  res.status(201).json(series);
});

invoiceSeriesRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const series = await prisma.invoiceSeries.findMany({
    where: { organizationId: parsed.data.organizationId },
    orderBy: { createdAt: "desc" }
  });

  res.json(series);
});
