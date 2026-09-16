import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { requireErpAdmin } from "../services/erp-session.js";

export const warehouseRouter = Router();
warehouseRouter.use((req, res, next) => req.method === "GET" ? next() : requireErpAdmin(req, res, next));

const organizationSchema = z.object({ organizationId: z.string().uuid() });
const createWarehouseSchema = z.object({
  organizationId: z.string().uuid(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(240).nullable().optional(),
  active: z.boolean().default(true)
});

warehouseRouter.get("/", async (req, res) => {
  const parsed = organizationSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const warehouses = await prisma.warehouse.findMany({
    where: { organizationId: parsed.data.organizationId },
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });
  res.json(warehouses);
});

warehouseRouter.post("/", async (req, res) => {
  const parsed = createWarehouseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  const organization = await prisma.organization.findUnique({ where: { id: data.organizationId } });
  if (!organization) return res.status(404).json({ error: "Η επιχείρηση δεν βρέθηκε." });

  try {
    const warehouse = await prisma.warehouse.create({
      data: {
        organizationId: data.organizationId,
        code: data.code.toUpperCase(),
        name: data.name,
        address: data.address ?? null,
        active: data.active
      }
    });
    res.status(201).json(warehouse);
  } catch {
    res.status(409).json({ error: "Υπάρχει ήδη αποθήκη με αυτόν τον κωδικό." });
  }
});

warehouseRouter.patch("/:id", async (req, res) => {
  const parsed = createWarehouseSchema.partial().omit({ organizationId: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const warehouse = await prisma.warehouse.update({
    where: { id: req.params.id },
    data: {
      ...(parsed.data.code ? { code: parsed.data.code.toUpperCase() } : {}),
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {})
    }
  });
  res.json(warehouse);
});
