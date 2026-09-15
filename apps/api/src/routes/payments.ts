import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const paymentRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(["CUSTOMER_RECEIPT", "SUPPLIER_PAYMENT"]).optional()
});

const createPaymentSchema = z.object({
  organizationId: z.string().uuid(),
  type: z.enum(["CUSTOMER_RECEIPT", "SUPPLIER_PAYMENT"]),
  customerId: z.string().uuid().nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  invoiceId: z.string().uuid().nullable().optional(),
  purchaseInvoiceId: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "IRIS", "OTHER"]).default("BANK_TRANSFER"),
  paymentDate: z.string().or(z.date()).optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

paymentRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payments = await prisma.payment.findMany({
    where: {
      organizationId: parsed.data.organizationId,
      ...(parsed.data.type ? { type: parsed.data.type } : {})
    },
    include: {
      customer: true,
      supplier: true,
      invoice: { include: { series: true } },
      purchaseInvoice: true
    },
    orderBy: { paymentDate: "desc" }
  });

  res.json(payments);
});

paymentRouter.post("/", async (req, res) => {
  const parsed = createPaymentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          organizationId: data.organizationId,
          type: data.type,
          customerId: data.customerId ?? null,
          supplierId: data.supplierId ?? null,
          invoiceId: data.invoiceId ?? null,
          purchaseInvoiceId: data.purchaseInvoiceId ?? null,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
          reference: data.reference ?? null,
          notes: data.notes ?? null
        },
        include: {
          customer: true,
          supplier: true,
          invoice: { include: { series: true } },
          purchaseInvoice: true
        }
      });

      // Update Invoice payment status if linked
      if (data.invoiceId) {
        const inv = await tx.invoice.findUnique({
          where: { id: data.invoiceId },
          include: { payments: true }
        });

        if (inv) {
          const totalPaid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0) + data.amount;
          const status = totalPaid >= Number(inv.totalAmount) ? "PAID" : totalPaid > 0 ? "PARTIAL" : "UNPAID";
          await tx.invoice.update({
            where: { id: inv.id },
            data: { paymentStatus: status }
          });
        }
      }

      // Update Purchase Invoice payment status if linked
      if (data.purchaseInvoiceId) {
        const pur = await tx.purchaseInvoice.findUnique({
          where: { id: data.purchaseInvoiceId },
          include: { payments: true }
        });

        if (pur) {
          const totalPaid = pur.payments.reduce((sum, p) => sum + Number(p.amount), 0) + data.amount;
          const status = totalPaid >= Number(pur.totalAmount) ? "PAID" : totalPaid > 0 ? "PARTIAL" : "UNPAID";
          await tx.purchaseInvoice.update({
            where: { id: pur.id },
            data: { paymentStatus: status }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId: data.organizationId,
          entityType: "payment",
          entityId: created.id,
          action: "CREATE_PAYMENT",
          newData: JSON.parse(JSON.stringify({
            type: data.type,
            amount: data.amount,
            method: data.paymentMethod,
            reference: data.reference
          }))
        }
      });

      return created;
    });

    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Payment registration failed"
    });
  }
});

// Customer Ledger (Καρτέλα Πελάτη)
paymentRouter.get("/customer-ledger/:customerId", async (req, res) => {
  const customerId = req.params.customerId;
  const organizationId = String(req.query.organizationId ?? "");

  if (!organizationId) {
    return res.status(400).json({ error: "organizationId is required" });
  }

  const [customer, invoices, payments] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, organizationId }
    }),
    prisma.invoice.findMany({
      where: {
        customerId,
        organizationId,
        status: { in: ["ISSUED", "CREDITED"] }
      },
      include: { series: true },
      orderBy: { issueDate: "asc" }
    }),
    prisma.payment.findMany({
      where: {
        customerId,
        organizationId,
        type: "CUSTOMER_RECEIPT"
      },
      include: { invoice: { include: { series: true } } },
      orderBy: { paymentDate: "asc" }
    })
  ]);

  if (!customer) return res.status(404).json({ error: "Customer not found" });

  type LedgerEntry = {
    id: string;
    date: Date;
    type: "INVOICE" | "CREDIT_NOTE" | "RECEIPT";
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  };

  const rawEntries: Array<{
    id: string;
    date: Date;
    type: "INVOICE" | "CREDIT_NOTE" | "RECEIPT";
    reference: string;
    description: string;
    debit: number;
    credit: number;
  }> = [];

  for (const inv of invoices) {
    const isCredit = inv.documentType === "5.1" || inv.documentType === "5.2";
    const total = Number(inv.totalAmount);
    rawEntries.push({
      id: inv.id,
      date: inv.issueDate ?? inv.createdAt,
      type: isCredit ? "CREDIT_NOTE" : "INVOICE",
      reference: `${inv.series.code}-${inv.invoiceNumber}`,
      description: isCredit ? `Πιστωτικό Τιμολόγιο ${inv.series.code}-${inv.invoiceNumber}` : `Τιμολόγιο ${inv.series.code}-${inv.invoiceNumber}`,
      debit: isCredit ? 0 : total,
      credit: isCredit ? total : 0
    });
  }

  for (const p of payments) {
    const amt = Number(p.amount);
    rawEntries.push({
      id: p.id,
      date: p.paymentDate,
      type: "RECEIPT",
      reference: p.reference || `ΑΠΟΔ-${p.id.substring(0, 6)}`,
      description: `Είσπραξη (${p.paymentMethod})${p.invoice ? ` για ${p.invoice.series.code}-${p.invoice.invoiceNumber}` : ""}${p.notes ? ` - ${p.notes}` : ""}`,
      debit: 0,
      credit: amt
    });
  }

  rawEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries: LedgerEntry[] = rawEntries.map((e) => {
    runningBalance += (e.debit - e.credit);
    totalDebit += e.debit;
    totalCredit += e.credit;
    return {
      ...e,
      balance: Number(runningBalance.toFixed(2))
    };
  });

  res.json({
    customer,
    totalBilled: Number(totalDebit.toFixed(2)),
    totalPaid: Number(totalCredit.toFixed(2)),
    currentBalance: Number(runningBalance.toFixed(2)),
    entries
  });
});

// Supplier Ledger (Καρτέλα Προμηθευτή)
paymentRouter.get("/supplier-ledger/:supplierId", async (req, res) => {
  const supplierId = req.params.supplierId;
  const organizationId = String(req.query.organizationId ?? "");

  if (!organizationId) {
    return res.status(400).json({ error: "organizationId is required" });
  }

  const [supplier, purchases, payments] = await Promise.all([
    prisma.supplier.findFirst({
      where: { id: supplierId, organizationId }
    }),
    prisma.purchaseInvoice.findMany({
      where: { supplierId, organizationId },
      orderBy: { issueDate: "asc" }
    }),
    prisma.payment.findMany({
      where: {
        supplierId,
        organizationId,
        type: "SUPPLIER_PAYMENT"
      },
      include: { purchaseInvoice: true },
      orderBy: { paymentDate: "asc" }
    })
  ]);

  if (!supplier) return res.status(404).json({ error: "Supplier not found" });

  type SupplierLedgerEntry = {
    id: string;
    date: Date;
    type: "PURCHASE" | "PAYMENT";
    reference: string;
    description: string;
    credit: number;
    debit: number;
    balance: number;
  };

  const rawEntries: Array<{
    id: string;
    date: Date;
    type: "PURCHASE" | "PAYMENT";
    reference: string;
    description: string;
    credit: number;
    debit: number;
  }> = [];

  for (const pur of purchases) {
    const total = Number(pur.totalAmount);
    rawEntries.push({
      id: pur.id,
      date: pur.issueDate,
      type: "PURCHASE",
      reference: pur.documentNumber,
      description: `Παραστατικό Αγοράς ${pur.documentNumber}`,
      credit: total,
      debit: 0
    });
  }

  for (const p of payments) {
    const amt = Number(p.amount);
    rawEntries.push({
      id: p.id,
      date: p.paymentDate,
      type: "PAYMENT",
      reference: p.reference || `ΠΛΗΡ-${p.id.substring(0, 6)}`,
      description: `Πληρωμή (${p.paymentMethod})${p.purchaseInvoice ? ` για ${p.purchaseInvoice.documentNumber}` : ""}${p.notes ? ` - ${p.notes}` : ""}`,
      credit: 0,
      debit: amt
    });
  }

  rawEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  let totalPurchases = 0;
  let totalPaid = 0;

  const entries: SupplierLedgerEntry[] = rawEntries.map((e) => {
    runningBalance += (e.credit - e.debit);
    totalPurchases += e.credit;
    totalPaid += e.debit;
    return {
      ...e,
      balance: Number(runningBalance.toFixed(2))
    };
  });

  res.json({
    supplier,
    totalPurchases: Number(totalPurchases.toFixed(2)),
    totalPaid: Number(totalPaid.toFixed(2)),
    currentBalance: Number(runningBalance.toFixed(2)),
    entries
  });
});
