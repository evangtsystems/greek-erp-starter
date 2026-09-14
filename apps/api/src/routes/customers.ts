import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const customerRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const createCustomerSchema = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(["BUSINESS", "INDIVIDUAL"]).default("BUSINESS"),
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

customerRouter.post("/", async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  const customer = await prisma.customer.create({
    data: {
      organizationId: data.organizationId,
      type: data.type,
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

  res.status(201).json(customer);
});

customerRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const customers = await prisma.customer.findMany({
    where: { organizationId: parsed.data.organizationId },
    orderBy: { createdAt: "desc" }
  });

  res.json(customers);
});
