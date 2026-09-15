import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const productRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const createProductSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  description: z.string().min(1).nullable().optional(),
  unit: z.string().min(1).default("piece"),
  unitPrice: z.coerce.number().nonnegative(),
  vatRate: z.coerce.number().min(0),
  classificationType: z.string().min(1).nullable().optional(),
  classificationCategory: z.string().min(1).nullable().optional(),
  active: z.boolean().default(true)
});

productRouter.post("/", async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  const product = await prisma.product.create({
    data: {
      organizationId: data.organizationId,
      code: data.code ?? null,
      name: data.name,
      description: data.description ?? null,
      unit: data.unit,
      unitPrice: data.unitPrice,
      vatRate: data.vatRate,
      classificationType: data.classificationType ?? null,
      classificationCategory: data.classificationCategory ?? null,
      active: data.active
    }
  });

  res.status(201).json(product);
});

productRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const products = await prisma.product.findMany({
    where: { organizationId: parsed.data.organizationId },
    orderBy: { createdAt: "desc" }
  });

  res.json(products);
});
