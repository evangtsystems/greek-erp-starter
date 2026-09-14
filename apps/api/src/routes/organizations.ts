import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const organizationRouter = Router();

const createOrganizationSchema = z.object({
  name: z.string().min(1),
  vatNumber: z.string().min(1).nullable().optional(),
  taxOffice: z.string().min(1).nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  city: z.string().min(1).nullable().optional(),
  postalCode: z.string().min(1).nullable().optional(),
  country: z.string().min(2).default("GR")
});

organizationRouter.post("/", async (req, res) => {
  const parsed = createOrganizationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  const organization = await prisma.organization.create({
    data: {
      name: data.name,
      vatNumber: data.vatNumber ?? null,
      taxOffice: data.taxOffice ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      postalCode: data.postalCode ?? null,
      country: data.country
    }
  });

  res.status(201).json(organization);
});

organizationRouter.get("/", async (_req, res) => {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.json(organizations);
});
