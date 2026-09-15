import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const productRouter = Router();
productRouter.use((req, res, next) => {
  if (req.method === "GET") return next();
  const key = process.env.ERP_ADMIN_API_KEY;
  if (!key || req.header("X-ERP-ADMIN-KEY") !== key) return res.status(401).json({ error: "Admin authentication required" });
  next();
});

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
  categoryId: z.string().uuid().nullable().optional(),
  trackSerialNumbers: z.boolean().default(false),
  active: z.boolean().default(true)
});

productRouter.post("/", async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  if (data.categoryId) {
    const category = await prisma.productCategory.findFirst({
      where: { id: data.categoryId, organizationId: data.organizationId }
    });
    if (!category) return res.status(422).json({ error: "Η κατηγορία δεν ανήκει στην επιλεγμένη επιχείρηση" });
  }

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
      categoryId: data.categoryId ?? null,
      trackSerialNumbers: data.trackSerialNumbers,
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
