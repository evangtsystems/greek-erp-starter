import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const organizationRouter = Router();

const organizationFields = {
  name: z.string().min(1),
  vatNumber: z.string().min(1).nullable(),
  taxOffice: z.string().min(1).nullable(),
  address: z.string().min(1).nullable(),
  city: z.string().min(1).nullable(),
  postalCode: z.string().min(1).nullable(),
  country: z.string().min(2)
};

const createOrganizationSchema = z.object({
  ...organizationFields,
  country: organizationFields.country.default("GR")
});

const updateOrganizationSchema = z.object(organizationFields).partial();

organizationRouter.post("/", async (req, res) => {
  const parsed = createOrganizationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  const organization = await prisma.organization.create({ data });
  res.status(201).json(organization);
});

organizationRouter.patch("/:id", async (req, res) => {
  const parsed = updateOrganizationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const organization = await prisma.organization.update({
      where: { id: req.params.id },
      data: parsed.data
    });
    res.json(organization);
  } catch {
    res.status(404).json({ error: "Organization not found" });
  }
});

organizationRouter.get("/", async (_req, res) => {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" }
  });

  res.json(organizations);
});
