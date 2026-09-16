import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { requireErpAdmin } from "../services/erp-session.js";

export const inventoryRouter = Router();
inventoryRouter.use((req, res, next) => req.method === "GET" ? next() : requireErpAdmin(req, res, next));

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional()
});

const createMovementSchema = z.object({
  organizationId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  type: z.enum(["INITIAL", "RECEIPT", "SALE", "ADJUSTMENT", "RETURN"]),
  quantity: z.coerce.number().refine((value) => value !== 0, { message: "Η ποσότητα δεν μπορεί να είναι 0" }),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  reference: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().min(1).optional().nullable(),
  serialNumbers: z.array(z.string().trim().min(1)).max(500).optional()
});

const transferSchema = z.object({
  organizationId: z.string().uuid(),
  productId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  reference: z.string().trim().min(1).optional().nullable(),
  notes: z.string().trim().min(1).optional().nullable(),
  serialNumbers: z.array(z.string().trim().min(1)).max(500).optional()
});

function signedQuantity(type: z.infer<typeof createMovementSchema>["type"], quantity: number) {
  if (type === "INITIAL" || type === "RECEIPT" || type === "RETURN") return Math.abs(quantity);
  if (type === "SALE") return -Math.abs(quantity);
  return quantity;
}

async function assertWarehouse(organizationId: string, warehouseId: string) {
  const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, organizationId, active: true } });
  if (!warehouse) throw new Error("Η αποθήκη δεν βρέθηκε ή δεν είναι ενεργή.");
  return warehouse;
}

// GET /api/inventory/balances - Products with balances, optionally per warehouse
inventoryRouter.get("/balances", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { organizationId, productId, warehouseId } = parsed.data;

  const products = await prisma.product.findMany({
    where: { organizationId, ...(productId ? { id: productId } : {}) },
    include: {
      category: { include: { family: true } },
      serials: {
        where: warehouseId ? { warehouseId } : undefined,
        select: { id: true, serialNumber: true, status: true, warehouseId: true }
      },
      stockMovements: {
        where: warehouseId ? { warehouseId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { name: "asc" }
  });

  const movements = await prisma.stockMovement.findMany({
    where: { organizationId, ...(productId ? { productId } : {}), ...(warehouseId ? { warehouseId } : {}) },
    select: { productId: true, quantity: true }
  });

  const balances: Record<string, number> = {};
  for (const movement of movements) balances[movement.productId] = (balances[movement.productId] ?? 0) + Number(movement.quantity);

  res.json(products.map((product) => ({
    id: product.id,
    code: product.code,
    name: product.name,
    description: product.description,
    unit: product.unit,
    unitPrice: product.unitPrice,
    vatRate: product.vatRate,
    trackSerialNumbers: product.trackSerialNumbers,
    category: product.category ? { id: product.category.id, name: product.category.name, familyName: product.category.family.name } : null,
    currentStock: balances[product.id] ?? 0,
    availableSerialsCount: product.serials.filter((serial) => serial.status === "AVAILABLE").length,
    lastMovementAt: product.stockMovements[0]?.createdAt ?? null
  })));
});

// GET /api/inventory/serials - Serial registry, optionally filtered by product/warehouse
inventoryRouter.get("/serials", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const serials = await prisma.stockSerial.findMany({
    where: {
      organizationId: parsed.data.organizationId,
      ...(parsed.data.productId ? { productId: parsed.data.productId } : {}),
      ...(parsed.data.warehouseId ? { warehouseId: parsed.data.warehouseId } : {})
    },
    include: {
      product: { select: { id: true, code: true, name: true } },
      warehouse: { select: { id: true, code: true, name: true } }
    },
    orderBy: { serialNumber: "asc" }
  });
  res.json(serials);
});

// GET /api/inventory/movements - Stock log
inventoryRouter.get("/movements", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const movements = await prisma.stockMovement.findMany({
    where: {
      organizationId: parsed.data.organizationId,
      ...(parsed.data.productId ? { productId: parsed.data.productId } : {}),
      ...(parsed.data.warehouseId ? { warehouseId: parsed.data.warehouseId } : {})
    },
    include: {
      product: { select: { id: true, code: true, name: true, unit: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      serial: { select: { id: true, serialNumber: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 300
  });
  res.json(movements);
});

// POST /api/inventory/movements - Movement and serial state change in one transaction
inventoryRouter.post("/movements", async (req, res) => {
  const parsed = createMovementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: data.productId, organizationId: data.organizationId } });
      if (!product) throw new Error("Το προϊόν δεν βρέθηκε για την επιλεγμένη επιχείρηση.");
      const warehouse = await tx.warehouse.findFirst({ where: { id: data.warehouseId, organizationId: data.organizationId, active: true } });
      if (!warehouse) throw new Error("Η αποθήκη δεν βρέθηκε ή δεν είναι ενεργή.");

      const serialNumbers = [...new Set(data.serialNumbers ?? [])];
      if (product.trackSerialNumbers) {
        if (!serialNumbers.length) throw new Error("Για αυτό το είδος απαιτούνται σειριακοί αριθμοί.");
        if (serialNumbers.length !== Math.abs(data.quantity)) throw new Error("Η ποσότητα πρέπει να ισούται με το πλήθος των serials.");
      } else if (serialNumbers.length) {
        throw new Error("Το προϊόν δεν έχει ενεργοποιημένη παρακολούθηση serial.");
      }

      const movements = [];
      if (!serialNumbers.length) {
        movements.push(await tx.stockMovement.create({
          data: {
            organizationId: data.organizationId, warehouseId: data.warehouseId, productId: data.productId,
            type: data.type, quantity: signedQuantity(data.type, data.quantity), unitCost: data.unitCost ?? null,
            reference: data.reference ?? null, notes: data.notes ?? null
          }
        }));
      } else {
        for (const serialNumber of serialNumbers) {
          let serial = await tx.stockSerial.findUnique({
            where: { organizationId_serialNumber: { organizationId: data.organizationId, serialNumber } }
          });

          if (data.type === "SALE") {
            if (!serial || serial.productId !== data.productId || serial.warehouseId !== data.warehouseId || serial.status !== "AVAILABLE") {
              throw new Error(`Το serial ${serialNumber} δεν είναι διαθέσιμο στην επιλεγμένη αποθήκη.`);
            }
            serial = await tx.stockSerial.update({ where: { id: serial.id }, data: { status: "SOLD" } });
          } else {
            if (serial && serial.productId !== data.productId) throw new Error(`Το serial ${serialNumber} ανήκει σε άλλο είδος.`);
            serial = serial
              ? await tx.stockSerial.update({ where: { id: serial.id }, data: { warehouseId: data.warehouseId, status: "AVAILABLE", notes: data.notes ?? serial.notes } })
              : await tx.stockSerial.create({ data: { organizationId: data.organizationId, productId: data.productId, warehouseId: data.warehouseId, serialNumber, status: "AVAILABLE", notes: data.notes ?? null } });
          }

          movements.push(await tx.stockMovement.create({
            data: {
              organizationId: data.organizationId, warehouseId: data.warehouseId, productId: data.productId,
              serialId: serial.id, type: data.type, quantity: signedQuantity(data.type, 1), unitCost: data.unitCost ?? null,
              reference: data.reference ?? null, notes: data.notes ?? null
            }
          }));
        }
      }
      return movements;
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Σφάλμα καταχώρισης κίνησης αποθήκης." });
  }
});

// POST /api/inventory/transfers - Atomic warehouse-to-warehouse transfer
inventoryRouter.post("/transfers", async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;
  if (data.fromWarehouseId === data.toWarehouseId) return res.status(400).json({ error: "Επίλεξε διαφορετικές αποθήκες." });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: data.productId, organizationId: data.organizationId } });
      if (!product) throw new Error("Το προϊόν δεν βρέθηκε.");
      const warehouses = await tx.warehouse.count({ where: { organizationId: data.organizationId, active: true, id: { in: [data.fromWarehouseId, data.toWarehouseId] } } });
      if (warehouses !== 2) throw new Error("Μία από τις αποθήκες δεν είναι διαθέσιμη.");

      const serialNumbers = [...new Set(data.serialNumbers ?? [])];
      if (product.trackSerialNumbers && (serialNumbers.length !== data.quantity)) throw new Error("Επίλεξε ένα serial για κάθε τεμάχιο.");
      if (!product.trackSerialNumbers && serialNumbers.length) throw new Error("Το είδος δεν παρακολουθεί serials.");

      if (!serialNumbers.length) {
        const balance = await tx.stockMovement.aggregate({ where: { organizationId: data.organizationId, productId: data.productId, warehouseId: data.fromWarehouseId }, _sum: { quantity: true } });
        if (Number(balance._sum.quantity ?? 0) < data.quantity) throw new Error("Ανεπαρκές διαθέσιμο απόθεμα στην αποθήκη προέλευσης.");
        const common = { organizationId: data.organizationId, productId: data.productId, type: "ADJUSTMENT" as const, reference: data.reference ?? "Μεταφορά αποθήκης", notes: data.notes ?? "Μεταφορά μεταξύ αποθηκών" };
        return Promise.all([
          tx.stockMovement.create({ data: { ...common, warehouseId: data.fromWarehouseId, quantity: -data.quantity } }),
          tx.stockMovement.create({ data: { ...common, warehouseId: data.toWarehouseId, quantity: data.quantity } })
        ]);
      }

      const records = await tx.stockSerial.findMany({ where: { organizationId: data.organizationId, productId: data.productId, warehouseId: data.fromWarehouseId, status: "AVAILABLE", serialNumber: { in: serialNumbers } } });
      if (records.length !== serialNumbers.length) throw new Error("Κάποια serial δεν είναι διαθέσιμα στην αποθήκη προέλευσης.");

      const output = [];
      for (const serial of records) {
        await tx.stockSerial.update({ where: { id: serial.id }, data: { warehouseId: data.toWarehouseId } });
        output.push(await tx.stockMovement.create({ data: { organizationId: data.organizationId, productId: data.productId, warehouseId: data.fromWarehouseId, serialId: serial.id, type: "ADJUSTMENT", quantity: -1, reference: data.reference ?? "Μεταφορά αποθήκης", notes: data.notes ?? "Μεταφορά μεταξύ αποθηκών" } }));
        output.push(await tx.stockMovement.create({ data: { organizationId: data.organizationId, productId: data.productId, warehouseId: data.toWarehouseId, serialId: serial.id, type: "ADJUSTMENT", quantity: 1, reference: data.reference ?? "Μεταφορά αποθήκης", notes: data.notes ?? "Μεταφορά μεταξύ αποθηκών" } }));
      }
      return output;
    });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Η μεταφορά δεν ολοκληρώθηκε." });
  }
});
