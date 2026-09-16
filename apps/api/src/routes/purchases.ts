import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { requireErpAdmin } from "../services/erp-session.js";

export const purchaseRouter = Router();
purchaseRouter.use((req, res, next) => req.method === "GET" ? next() : requireErpAdmin(req, res, next));

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const createPurchaseSchema = z.object({
  organizationId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  supplierId: z.string().uuid(),
  documentNumber: z.string().trim().min(1),
  documentType: z.string().trim().default("14.1"),
  issueDate: z.coerce.date().default(() => new Date()),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "IRIS", "OTHER"]).default("BANK_TRANSFER"),
  paymentStatus: z.string().default("PAID"),
  notes: z.string().trim().nullable().optional(),
  lines: z.array(z.object({
    productId: z.string().uuid().nullable().optional(),
    description: z.string().trim().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    vatRate: z.coerce.number().min(0).default(24)
  })).min(1)
});

// GET /api/purchases - List purchase invoices
purchaseRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const purchases = await prisma.purchaseInvoice.findMany({
    where: { organizationId: parsed.data.organizationId },
    include: {
      supplier: true,
      lines: {
        include: { product: true }
      }
    },
    orderBy: { issueDate: "desc" }
  });

  res.json(purchases);
});

// POST /api/purchases - Record a purchase invoice with auto stock receipt
purchaseRouter.post("/", async (req, res) => {
  const parsed = createPurchaseSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  try {
    const purchase = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: data.supplierId, organizationId: data.organizationId }
      });

      if (!supplier) {
        throw new Error("Ο προμηθευτής δεν βρέθηκε για την επιλεγμένη επιχείρηση");
      }

      const warehouse = data.warehouseId
        ? await tx.warehouse.findFirst({ where: { id: data.warehouseId, organizationId: data.organizationId, active: true } })
        : await tx.warehouse.findFirst({ where: { organizationId: data.organizationId, code: "MAIN", active: true } });
      if (!warehouse) throw new Error("Δεν βρέθηκε ενεργή αποθήκη για την παραλαβή.");

      // Check unique document number for this supplier
      const existing = await tx.purchaseInvoice.findUnique({
        where: {
          organizationId_supplierId_documentNumber: {
            organizationId: data.organizationId,
            supplierId: data.supplierId,
            documentNumber: data.documentNumber
          }
        }
      });

      if (existing) {
        throw new Error(`Το παραστατικό ${data.documentNumber} έχει ήδη καταχωρηθεί για αυτόν τον προμηθευτή`);
      }

      const calculatedLines = data.lines.map((line, index) => {
        const net = line.quantity * line.unitPrice;
        const vat = net * (line.vatRate / 100);

        return {
          lineNo: index + 1,
          productId: line.productId ?? null,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          netValue: Number(net.toFixed(2)),
          vatRate: line.vatRate,
          vatAmount: Number(vat.toFixed(2)),
          totalValue: Number((net + vat).toFixed(2))
        };
      });

      const netAmount = calculatedLines.reduce((sum, l) => sum + l.netValue, 0);
      const vatAmount = calculatedLines.reduce((sum, l) => sum + l.vatAmount, 0);
      const totalAmount = Number((netAmount + vatAmount).toFixed(2));

      const createdPurchase = await tx.purchaseInvoice.create({
        data: {
          organizationId: data.organizationId,
          supplierId: data.supplierId,
          documentNumber: data.documentNumber,
          documentType: data.documentType,
          issueDate: data.issueDate,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentStatus,
          netAmount,
          vatAmount,
          totalAmount,
          notes: data.notes ?? null,
          lines: {
            create: calculatedLines
          }
        },
        include: {
          supplier: true,
          lines: {
            include: { product: true }
          }
        }
      });

      // Auto stock receipt for lines linked to inventory products
      for (const line of createdPurchase.lines) {
        if (line.productId) {
          await tx.stockMovement.create({
            data: {
              organizationId: data.organizationId,
              warehouseId: warehouse.id,
              productId: line.productId,
              type: "RECEIPT",
              quantity: Math.abs(Number(line.quantity)),
              unitCost: Number(line.unitPrice),
              reference: `Αγορά ${data.documentNumber} (${supplier.name})`,
              notes: `Αυτόματη παραλαβή από καταχώριση αγοράς`
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: data.organizationId,
          entityType: "purchase_invoice",
          entityId: createdPurchase.id,
          action: "CREATE_PURCHASE",
          newData: {
            supplier: supplier.name,
            documentNumber: data.documentNumber,
            totalAmount
          }
        }
      });

      return createdPurchase;
    });

    res.status(201).json(purchase);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Σφάλμα κατά την καταχώριση αγοράς"
    });
  }
});
