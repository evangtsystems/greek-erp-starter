import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { requireErpAdmin } from "../services/erp-session.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireErpAdmin);

const movementSchema = z.object({
  organizationId: z.string().uuid(),
  productId: z.string().uuid(),
  serialId: z.string().uuid().nullable().optional(),
  type: z.enum(["OPENING", "RECEIPT", "SALE", "ADJUSTMENT"]),
  quantity: z.coerce.number().refine((value) => value !== 0),
  reference: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional()
});

inventoryRouter.get("/", async (req, res) => {
  const organizationId = z.string().uuid().safeParse(req.query.organizationId);
  if (!organizationId.success) return res.status(400).json({ error: organizationId.error.flatten() });
  const movements = await prisma.stockMovement.findMany({
    where: { organizationId: organizationId.data },
    include: { product: true, serial: true },
    orderBy: { createdAt: "desc" }
  });
  const balances = new Map<string, number>();
  for (const item of movements) balances.set(item.productId, (balances.get(item.productId) ?? 0) + Number(item.quantity));
  res.json({ movements, balances: Object.fromEntries(balances) });
});

inventoryRouter.post("/movements", async (req, res) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  const product = await prisma.product.findFirst({ where: { id: data.productId, organizationId: data.organizationId } });
  if (!product) return res.status(404).json({ error: "Το είδος δεν ανήκει στην επιλεγμένη επιχείρηση" });
  if (data.serialId) {
    const serial = await prisma.stockSerial.findFirst({ where: { id: data.serialId, productId: data.productId, organizationId: data.organizationId } });
    if (!serial) return res.status(404).json({ error: "Ο σειριακός αριθμός δεν ανήκει στο είδος" });
  }
  const movement = await prisma.stockMovement.create({ data });
  res.status(201).json(movement);
});