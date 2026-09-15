import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { requireErpAdmin } from "../services/erp-session.js";

export const supplierRouter = Router();
supplierRouter.use((req, res, next) => req.method === "GET" ? next() : requireErpAdmin(req, res, next));

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const createSupplierSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  vatNumber: z.string().min(1).nullable().optional(),
  taxOffice: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  city: z.string().min(1).nullable().optional(),
  postalCode: z.string().min(1).nullable().optional(),
  country: z.string().min(2).default("GR")
});

supplierRouter.post("/", async (req, res) => {
  const parsed = createSupplierSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  const supplier = await prisma.supplier.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      vatNumber: data.vatNumber ?? null,
      taxOffice: data.taxOffice ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      postalCode: data.postalCode ?? null,
      country: data.country
    }
  });

  res.status(201).json(supplier);
});

supplierRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: parsed.data.organizationId },
    orderBy: { name: "asc" }
  });

  res.json(suppliers);
});
