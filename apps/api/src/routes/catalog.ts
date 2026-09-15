import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const catalogRouter = Router();
const organization = z.object({ organizationId: z.string().uuid() });
const notFound = (res: import("express").Response) => res.status(404).json({ error: "Catalog item not found for this organization" });

catalogRouter.get("/", async (req, res) => {
  const parsed = organization.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.json(await prisma.productFamily.findMany({ where: { organizationId: parsed.data.organizationId }, include: { categories: { include: { products: { include: { serials: true } } } } }, orderBy: { name: "asc" } }));
});

catalogRouter.post("/families", async (req, res) => {
  const parsed = organization.extend({ name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(await prisma.productFamily.create({ data: parsed.data }));
});

catalogRouter.post("/categories", async (req, res) => {
  const parsed = organization.extend({ familyId: z.string().uuid(), name: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const family = await prisma.productFamily.findFirst({ where: { id: parsed.data.familyId, organizationId: parsed.data.organizationId } });
  if (!family) return notFound(res);
  res.status(201).json(await prisma.productCategory.create({ data: parsed.data }));
});

catalogRouter.post("/serials", async (req, res) => {
  const parsed = organization.extend({ productId: z.string().uuid(), serialNumber: z.string().min(1), notes: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const product = await prisma.product.findFirst({ where: { id: parsed.data.productId, organizationId: parsed.data.organizationId, trackSerialNumbers: true } });
  if (!product) return notFound(res);
  res.status(201).json(await prisma.stockSerial.create({ data: { ...parsed.data, notes: parsed.data.notes ?? null } }));
});

catalogRouter.patch("/serials/:id/status", async (req, res) => {
  const parsed = organization.extend({ status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "RETURNED", "IN_REPAIR"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const serial = await prisma.stockSerial.findFirst({ where: { id: req.params.id, organizationId: parsed.data.organizationId } });
  if (!serial) return notFound(res);
  res.json(await prisma.stockSerial.update({ where: { id: serial.id }, data: { status: parsed.data.status } }));
});
