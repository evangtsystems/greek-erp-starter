import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { requireErpAdmin } from "../services/erp-session.js";

export const inventoryRouter = Router();
inventoryRouter.use((req, res, next) => req.method === "GET" ? next() : requireErpAdmin(req, res, next));

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid(),
  productId: z.string().uuid().optional()
});

const createMovementSchema = z.object({
  organizationId: z.string().uuid(),
  productId: z.string().uuid(),
  type: z.enum(["INITIAL", "RECEIPT", "SALE", "ADJUSTMENT", "RETURN"]),
  quantity: z.coerce.number().refine((val) => val !== 0, { message: "Η ποσότητα δεν μπορεί να είναι 0" }),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  reference: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().min(1).optional().nullable()
});

// GET /api/inventory/balances - Get all products with stock balances
inventoryRouter.get("/balances", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { organizationId, productId } = parsed.data;

  const products = await prisma.product.findMany({
    where: {
      organizationId,
      ...(productId ? { id: productId } : {})
    },
    include: {
      category: {
        include: {
          family: true
        }
      },
      serials: {
        select: {
          id: true,
          serialNumber: true,
          status: true
        }
      },
      stockMovements: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { name: "asc" }
  });

  // Calculate sum of quantities per product
  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId,
      ...(productId ? { productId } : {})
    },
    select: {
      productId: true,
      quantity: true
    }
  });

  const balancesMap: Record<string, number> = {};
  for (const mov of movements) {
    const qty = Number(mov.quantity);
    balancesMap[mov.productId] = (balancesMap[mov.productId] ?? 0) + qty;
  }

  const result = products.map((prod) => {
    const currentStock = balancesMap[prod.id] ?? 0;
    const availableSerialsCount = prod.serials.filter((s) => s.status === "AVAILABLE").length;
    return {
      id: prod.id,
      code: prod.code,
      name: prod.name,
      description: prod.description,
      unit: prod.unit,
      unitPrice: prod.unitPrice,
      vatRate: prod.vatRate,
      trackSerialNumbers: prod.trackSerialNumbers,
      category: prod.category ? {
        id: prod.category.id,
        name: prod.category.name,
        familyName: prod.category.family.name
      } : null,
      currentStock,
      availableSerialsCount,
      lastMovementAt: prod.stockMovements[0]?.createdAt ?? null
    };
  });

  res.json(result);
});

// GET /api/inventory/movements - Get stock movement log
inventoryRouter.get("/movements", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { organizationId, productId } = parsed.data;

  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId,
      ...(productId ? { productId } : {})
    },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  res.json(movements);
});

// POST /api/inventory/movements - Record a stock movement
inventoryRouter.post("/movements", async (req, res) => {
  const parsed = createMovementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  // Validate that product belongs to the organization
  const product = await prisma.product.findFirst({
    where: { id: data.productId, organizationId: data.organizationId }
  });

  if (!product) {
    return res.status(404).json({ error: "Το προϊόν δεν βρέθηκε για την επιλεγμένη επιχείρηση" });
  }

  // Determine signed quantity based on type
  let signedQuantity = data.quantity;
  if (data.type === "INITIAL" || data.type === "RECEIPT" || data.type === "RETURN") {
    signedQuantity = Math.abs(data.quantity);
  } else if (data.type === "SALE") {
    signedQuantity = -Math.abs(data.quantity);
  } else if (data.type === "ADJUSTMENT") {
    // Keep user-supplied positive or negative sign for adjustment
    signedQuantity = data.quantity;
  }

  const movement = await prisma.stockMovement.create({
    data: {
      organizationId: data.organizationId,
      productId: data.productId,
      type: data.type,
      quantity: signedQuantity,
      unitCost: data.unitCost ?? null,
      reference: data.reference ?? null,
      notes: data.notes ?? null
    },
    include: {
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true
        }
      }
    }
  });

  res.status(201).json(movement);
});
