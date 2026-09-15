import { Router } from "express";
import { z } from "zod";
import QRCode from "qrcode";
import { prisma } from "../../../../packages/database/src/client.js";
import { validateInvoiceReadiness } from "../services/invoice-readiness.js";
import { issueInvoiceWithProvider } from "../services/provider-issue.js";
import { issueWrappStagingInvoice } from "../services/wrapp-staging-issue.js";
import { requireErpAdmin } from "../services/erp-session.js";

export const invoiceRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const draftInvoiceSchema = z.object({
  organizationId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  seriesId: z.string().uuid(),
  documentType: z.string().min(1),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER", "IRIS", "OTHER"]).default("BANK_TRANSFER"),
  lines: z.array(z.object({
    productId: z.string().uuid().nullable().optional(),
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().nonnegative(),
    vatCategory: z.string().min(1).nullable().optional(),
    vatRate: z.coerce.number().min(0),
    classificationType: z.string().min(1).nullable().optional(),
    classificationCategory: z.string().min(1).nullable().optional()
  })).min(1)
});

const providerIssueSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.string().min(1).optional()
});

invoiceRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: parsed.data.organizationId },
    include: { customer: true, series: true, lines: true, creditedInvoice: true, creditNotes: true },
    orderBy: { createdAt: "desc" }
  });

  res.json(invoices);
});

invoiceRouter.post("/", async (req, res) => {
  const parsed = draftInvoiceSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;

  const lines = data.lines.map((line, index) => {
    const net = line.quantity * line.unitPrice;
    const vat = net * (line.vatRate / 100);

    return {
      productId: line.productId ?? null,
      lineNo: index + 1,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: 0,
      netValue: Number(net.toFixed(2)),
      vatCategory: line.vatCategory ?? null,
      vatRate: line.vatRate,
      vatAmount: Number(vat.toFixed(2)),
      classificationType: line.classificationType ?? null,
      classificationCategory: line.classificationCategory ?? null,
      totalValue: Number((net + vat).toFixed(2))
    };
  });

  const netAmount = lines.reduce((sum, l) => sum + l.netValue, 0);
  const vatAmount = lines.reduce((sum, l) => sum + l.vatAmount, 0);

  const invoice = await prisma.invoice.create({
    data: {
      organizationId: data.organizationId,
      customerId: data.customerId ?? null,
      seriesId: data.seriesId,
      documentType: data.documentType,
      paymentMethod: data.paymentMethod,
      netAmount,
      vatAmount,
      totalAmount: netAmount + vatAmount,
      lines: { create: lines }
    },
    include: { lines: true }
  });

  res.status(201).json(invoice);
});

invoiceRouter.get("/:id/readiness", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, organizationId: parsed.data.organizationId },
    include: { organization: true, customer: true, series: true, lines: true }
  });

  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  res.json({
    invoiceId: invoice.id,
    status: invoice.status,
    readiness: validateInvoiceReadiness(invoice)
  });
});

invoiceRouter.post("/:id/issue-wrapp-staging", requireErpAdmin, async (req, res) => {
  const organizationId = String(req.body.organizationId ?? "");
  const invoiceId = String(req.params.id);
  try { res.status(201).json(await issueWrappStagingInvoice(organizationId, invoiceId)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Could not issue staging invoice" }); }
});

invoiceRouter.post("/:id/issue-provider", async (req, res) => {
  const parsed = providerIssueSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await issueInvoiceWithProvider({
      organizationId: parsed.data.organizationId,
      invoiceId: req.params.id,
      provider: parsed.data.provider
    });

    if (!result.accepted) return res.status(422).json(result);

    res.status(202).json({
      ...result,
      message: "Provider transmission queued. Add a concrete EInvoiceProvider adapter to send it."
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

invoiceRouter.post("/:id/issue-local", async (req, res) => {
  const invoiceId = req.params.id;
  const organizationId = String(req.body.organizationId ?? "");

  try {
    const issued = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: { series: true }
      });

      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status !== "DRAFT" && invoice.status !== "READY") {
        throw new Error(`Invoice cannot be issued from ${invoice.status}`);
      }

      // Atomic increment: UPDATE ... RETURNING avoids duplicate numbering
      // when multiple invoices are issued concurrently.
      const updatedSeries = await tx.$queryRaw<
        Array<{ next_number: number }>
      >`
        UPDATE invoice_series
        SET next_number = next_number + 1,
            updated_at = NOW()
        WHERE id = ${invoice.seriesId}
          AND organization_id = ${organizationId}
        RETURNING next_number
      `;

      if (updatedSeries.length !== 1) throw new Error("Invoice series not found");

      const assignedNumber = updatedSeries[0].next_number - 1;

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          invoiceNumber: assignedNumber,
          issueDate: new Date(),
          status: "ISSUED",
          issuedAt: new Date(),
          providerStatus: "LOCAL_ONLY"
        },
        include: { lines: true, customer: true, series: true }
      });

      // Automatic stock deduction for items linked to products
      for (const line of updated.lines) {
        if (line.productId) {
          await tx.stockMovement.create({
            data: {
              organizationId,
              productId: line.productId,
              type: "SALE",
              quantity: -Math.abs(Number(line.quantity)),
              reference: `${updated.series.code}-${assignedNumber}`,
              notes: `Αυτόματη μείωση από έκδοση παραστατικού ${updated.series.code}-${assignedNumber}`
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          entityType: "invoice",
          entityId: invoice.id,
          action: "ISSUE_LOCAL",
          newData: JSON.parse(JSON.stringify({
            series: updated.series.code,
            number: assignedNumber,
            totalAmount: updated.totalAmount.toString()
          }))
        }
      });

      return updated;
    });

    res.json(issued);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

const cancelInvoiceSchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().optional()
});

invoiceRouter.post("/:id/cancel", async (req, res) => {
  const parsed = cancelInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const invoiceId = req.params.id;
  const { organizationId, reason } = parsed.data;

  try {
    const cancelled = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: { series: true, lines: true }
      });

      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status !== "ISSUED") {
        throw new Error(`Cannot cancel invoice with status ${invoice.status}. Only ISSUED invoices can be cancelled.`);
      }

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelReason: reason || "Ακύρωση παραστατικού"
        },
        include: { series: true, lines: true, customer: true }
      });

      // Restore stock for all lines linked to products
      for (const line of invoice.lines) {
        if (line.productId) {
          await tx.stockMovement.create({
            data: {
              organizationId,
              productId: line.productId,
              type: "RETURN",
              quantity: Math.abs(Number(line.quantity)),
              reference: `ΑΚΥΡΩΣΗ ${invoice.series.code}-${invoice.invoiceNumber}`,
              notes: `Επαναφορά αποθέματος λόγω ακύρωσης παραστατικού ${invoice.series.code}-${invoice.invoiceNumber}${reason ? ` (${reason})` : ""}`
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          entityType: "invoice",
          entityId: invoice.id,
          action: "CANCEL_INVOICE",
          newData: JSON.parse(JSON.stringify({
            series: invoice.series.code,
            number: invoice.invoiceNumber,
            reason: reason || "Ακύρωση παραστατικού"
          }))
        }
      });

      return updated;
    });

    res.json(cancelled);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

const creditNoteSchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().optional(),
  seriesId: z.string().uuid().optional()
});

invoiceRouter.post("/:id/credit-note", async (req, res) => {
  const parsed = creditNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const invoiceId = req.params.id;
  const { organizationId, reason, seriesId } = parsed.data;

  try {
    const creditInvoice = await prisma.$transaction(async (tx) => {
      const original = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId },
        include: { series: true, lines: true, customer: true }
      });

      if (!original) throw new Error("Original invoice not found");
      if (original.status !== "ISSUED") {
        throw new Error(`Cannot issue credit note for invoice with status ${original.status}. Only ISSUED invoices can be credited.`);
      }

      // Find series for credit note: specified seriesId OR any series with doc type 5.1/5.2 OR fallback to original series
      let creditSeries = seriesId
        ? await tx.invoiceSeries.findFirst({ where: { id: seriesId, organizationId } })
        : await tx.invoiceSeries.findFirst({ where: { organizationId, documentType: "5.1" } });

      if (!creditSeries) {
        creditSeries = await tx.invoiceSeries.findFirst({
          where: { organizationId, id: original.seriesId }
        });
      }

      if (!creditSeries) throw new Error("Invoice series for credit note not found");

      // Atomically increment the credit series
      const updatedSeries = await tx.$queryRaw<
        Array<{ next_number: number }>
      >`
        UPDATE invoice_series
        SET next_number = next_number + 1,
            updated_at = NOW()
        WHERE id = ${creditSeries.id}
          AND organization_id = ${organizationId}
        RETURNING next_number
      `;

      if (updatedSeries.length !== 1) throw new Error("Failed to reserve credit invoice number");
      const assignedNumber = updatedSeries[0].next_number - 1;

      // Mark original invoice as CREDITED
      await tx.invoice.update({
        where: { id: original.id },
        data: {
          status: "CREDITED",
          cancelReason: `Πιστωτικό ${creditSeries.code}-${assignedNumber}${reason ? `: ${reason}` : ""}`
        }
      });

      // Create new credit note invoice
      const newCreditNote = await tx.invoice.create({
        data: {
          organizationId,
          customerId: original.customerId,
          seriesId: creditSeries.id,
          invoiceNumber: assignedNumber,
          documentType: "5.1",
          issueDate: new Date(),
          issuedAt: new Date(),
          status: "ISSUED",
          paymentMethod: original.paymentMethod,
          netAmount: original.netAmount,
          vatAmount: original.vatAmount,
          totalAmount: original.totalAmount,
          providerStatus: "LOCAL_ONLY",
          cancelReason: reason || `Πιστωτικό για το παραστατικό ${original.series.code}-${original.invoiceNumber}`,
          creditedInvoiceId: original.id,
          lines: {
            create: original.lines.map((l) => ({
              productId: l.productId,
              lineNo: l.lineNo,
              description: `Πιστωτικό: ${l.description}`,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: l.discountAmount,
              netValue: l.netValue,
              vatCategory: l.vatCategory,
              vatRate: l.vatRate,
              vatAmount: l.vatAmount,
              classificationType: l.classificationType,
              classificationCategory: l.classificationCategory,
              totalValue: l.totalValue
            }))
          }
        },
        include: { lines: true, customer: true, series: true, creditedInvoice: true }
      });

      // Restore stock for product lines
      for (const line of original.lines) {
        if (line.productId) {
          await tx.stockMovement.create({
            data: {
              organizationId,
              productId: line.productId,
              type: "RETURN",
              quantity: Math.abs(Number(line.quantity)),
              reference: `${creditSeries.code}-${assignedNumber}`,
              notes: `Επιστροφή αποθέματος μέσω Πιστωτικού ${creditSeries.code}-${assignedNumber} (συσχετισμένο με ${original.series.code}-${original.invoiceNumber})`
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          organizationId,
          entityType: "invoice",
          entityId: newCreditNote.id,
          action: "ISSUE_CREDIT_NOTE",
          newData: JSON.parse(JSON.stringify({
            series: creditSeries.code,
            number: assignedNumber,
            creditedInvoiceId: original.id,
            totalAmount: newCreditNote.totalAmount.toString()
          }))
        }
      });

      return newCreditNote;
    });

    res.status(201).json(creditInvoice);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

invoiceRouter.get("/:id/print", async (req, res) => {
  const invoiceId = req.params.id;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
        customer: true,
        series: true,
        lines: { include: { product: true } },
        creditedInvoice: { include: { series: true } }
      }
    });

    if (!invoice) {
      return res.status(404).send("<h1>404 - Το παραστατικό δεν βρέθηκε</h1>");
    }

    // Generate QR Code data URL
    const qrPayload = invoice.qrUrl
      || (invoice.mydataMark ? `https://www.aade.gr/mydata/verify?mark=${invoice.mydataMark}&uid=${invoice.mydataUid || ""}` : `ERP:${invoice.organization.name}|${invoice.series.code}-${invoice.invoiceNumber || "DRAFT"}|TOTAL:${invoice.totalAmount}EUR|MARK:${invoice.mydataMark || "NONE"}`);

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 140
    });

    const docTypeNames: Record<string, string> = {
      "1.1": "ΤΙΜΟΛΟΓΙΟ ΠΩΛΗΣΗΣ",
      "2.1": "ΤΙΜΟΛΟΓΙΟ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ",
      "5.1": "ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ",
      "5.2": "ΠΙΣΤΩΤΙΚΟ ΤΙΜΟΛΟΓΙΟ / ΜΗ ΣΥΣΧΕΤΙΖΟΜΕΝΟ",
      "11.1": "ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ ΠΩΛΗΣΗΣ",
      "11.2": "ΑΠΟΔΕΙΞΗ ΠΑΡΟΧΗΣ ΥΠΗΡΕΣΙΩΝ"
    };

    const docTitle = docTypeNames[invoice.documentType] || `ΠΑΡΑΣΤΑΤΙΚΟ (${invoice.documentType})`;
    const isCredit = invoice.documentType === "5.1" || invoice.documentType === "5.2";
    const paymentMethods: Record<string, string> = {
      BANK_TRANSFER: "Τραπεζική Κατάθεση",
      CARD: "Χρεωστική / Πιστωτική Κάρτα",
      CASH: "Μετρητά",
      IRIS: "IRIS Payments",
      OTHER: "Άλλος τρόπος"
    };

    const formattedDate = invoice.issueDate
      ? new Date(invoice.issueDate).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date(invoice.createdAt).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const html = `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle} - ${invoice.series.code}-${invoice.invoiceNumber || "DRAFT"}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1a202c;
      background: #f7fafc;
      padding: 24px;
      line-height: 1.5;
    }
    .print-actions {
      max-width: 800px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
      border: 1px solid transparent;
    }
    .btn-primary {
      background: #0f766e;
      color: #fff;
    }
    .btn-primary:hover { background: #0a554f; }
    .btn-secondary {
      background: #e2e8f0;
      color: #334155;
    }
    .btn-secondary:hover { background: #cbd5e1; }
    
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f766e;
      margin-bottom: 6px;
    }
    .company-details, .doc-details {
      font-size: 13px;
      color: #4a5568;
    }
    .company-details p, .doc-details p {
      margin-bottom: 3px;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      font-size: 15px;
      font-weight: 800;
      color: ${isCredit ? "#9d174d" : "#0f766e"};
      background: ${isCredit ? "#fdf2f8" : "#f0fdfa"};
      border: 1px solid ${isCredit ? "#fbcfe8" : "#ccfbf1"};
      padding: 6px 14px;
      border-radius: 6px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .doc-number {
      font-size: 20px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 4px;
    }

    .counterparty-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 28px;
    }
    .card-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
      font-size: 13px;
    }
    .card-box h3 {
      font-size: 12px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .card-box strong {
      font-size: 15px;
      color: #1e293b;
      display: block;
      margin-bottom: 6px;
    }

    .lines-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 28px;
    }
    .lines-table th {
      background: #0f766e;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 10px 12px;
      border: 1px solid #0f766e;
    }
    .lines-table td {
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    .lines-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }

    .totals-and-mydata {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .mydata-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 16px;
      background: #ffffff;
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .mydata-box img {
      width: 100px;
      height: 100px;
      display: block;
    }
    .mydata-info {
      font-size: 12px;
      color: #475569;
    }
    .mydata-info strong {
      display: block;
      color: #1e293b;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .totals-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #475569;
      padding: 4px 0;
    }
    .totals-row.grand-total {
      border-top: 2px solid #0f766e;
      margin-top: 8px;
      padding-top: 8px;
      font-size: 18px;
      font-weight: 800;
      color: #0f766e;
    }

    .footer-notes {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .print-actions {
        display: none !important;
      }
      .invoice-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn btn-secondary" onclick="window.close()">✕ Κλείσιμο</button>
    <button class="btn btn-primary" onclick="window.print()">🖨️ Εκτύπωση / Αποθήκευση PDF</button>
  </div>

  <div class="invoice-container">
    <div class="header">
      <div class="company-details">
        <div class="brand-title">${invoice.organization.name}</div>
        <p><strong>ΑΦΜ:</strong> ${invoice.organization.vatNumber || "—"} | <strong>ΔΟΥ:</strong> ${invoice.organization.taxOffice || "—"}</p>
        <p><strong>Διεύθυνση:</strong> ${invoice.organization.address || "—"}, ${invoice.organization.postalCode || ""} ${invoice.organization.city || ""}</p>
        <p><strong>Χώρα:</strong> ${invoice.organization.country}</p>
      </div>
      <div class="doc-meta">
        <div class="doc-badge">${docTitle}</div>
        <div class="doc-number">${invoice.series.code}-${invoice.invoiceNumber || "ΠΡΟΧΕΙΡΟ"}</div>
        <div class="doc-details">
          <p><strong>Ημερομηνία:</strong> ${formattedDate}</p>
          <p><strong>Τρόπος Πληρωμής:</strong> ${paymentMethods[invoice.paymentMethod] || invoice.paymentMethod}</p>
          <p><strong>Κατάσταση:</strong> ${invoice.status}</p>
        </div>
      </div>
    </div>

    <div class="counterparty-grid">
      <div class="card-box">
        <h3>Στοιχεία Πελάτη / Λήπτη</h3>
        <strong>${invoice.customer?.name || "Λιανική / Ιδιώτης"}</strong>
        <p><strong>ΑΦΜ:</strong> ${invoice.customer?.vatNumber || "—"} | <strong>ΔΟΥ:</strong> ${invoice.customer?.taxOffice || "—"}</p>
        <p><strong>Διεύθυνση:</strong> ${invoice.customer?.address || "—"}, ${invoice.customer?.postalCode || ""} ${invoice.customer?.city || ""}</p>
        <p><strong>Χώρα:</strong> ${invoice.customer?.country || "GR"}</p>
      </div>

      <div class="card-box">
        <h3>Πληροφορίες Παραστατικού</h3>
        <p><strong>Σειρά:</strong> ${invoice.series.code}</p>
        <p><strong>Τύπος myDATA:</strong> ${invoice.documentType}</p>
        ${invoice.creditedInvoice ? `
        <p style="color: #9d174d; font-weight: bold; margin-top: 6px;">
          Συσχετιζόμενο Παραστατικό: ${invoice.creditedInvoice.series.code}-${invoice.creditedInvoice.invoiceNumber}
        </p>` : ""}
        ${invoice.cancelReason ? `<p style="margin-top: 4px; font-style: italic;">Αιτιολογία: ${invoice.cancelReason}</p>` : ""}
      </div>
    </div>

    <table class="lines-table">
      <thead>
        <tr>
          <th class="text-center" style="width: 40px;">#</th>
          <th>Περιγραφή Είδους / Υπηρεσίας</th>
          <th class="text-right" style="width: 80px;">Ποσότητα</th>
          <th class="text-right" style="width: 100px;">Τιμή Μον.</th>
          <th class="text-right" style="width: 100px;">Καθαρή Αξία</th>
          <th class="text-center" style="width: 70px;">ΦΠΑ %</th>
          <th class="text-right" style="width: 90px;">Ποσό ΦΠΑ</th>
          <th class="text-right" style="width: 110px;">Σύνολο</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.lines.map((l) => `
          <tr>
            <td class="text-center">${l.lineNo}</td>
            <td>
              <strong>${l.description}</strong>
              ${l.product?.code ? `<div style="font-size: 11px; color: #64748b;">Κωδικός: ${l.product.code}</div>` : ""}
            </td>
            <td class="text-right">${Number(l.quantity)}</td>
            <td class="text-right">${Number(l.unitPrice).toFixed(2)} €</td>
            <td class="text-right">${Number(l.netValue).toFixed(2)} €</td>
            <td class="text-center">${Number(l.vatRate)}%</td>
            <td class="text-right">${Number(l.vatAmount).toFixed(2)} €</td>
            <td class="text-right"><strong>${Number(l.totalValue).toFixed(2)} €</strong></td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="totals-and-mydata">
      <div class="mydata-box">
        <img src="${qrDataUrl}" alt="AADE QR Code" />
        <div class="mydata-info">
          <strong>Ηλεκτρονική Σήμανση myDATA</strong>
          <p><strong>MARK:</strong> ${invoice.mydataMark || "— (Τοπική Έκδοση)"}</p>
          <p><strong>UID:</strong> ${invoice.mydataUid || "—"}</p>
          <p><strong>Πάροχος:</strong> ${invoice.providerStatus || "LOCAL_ONLY"}</p>
          <p style="font-size: 11px; margin-top: 4px; color: #64748b;">Σαρώστε το QR code για επαλήθευση στην ΑΑΔΕ</p>
        </div>
      </div>

      <div class="totals-box">
        <div class="totals-row">
          <span>Καθαρή Αξία:</span>
          <strong>${Number(invoice.netAmount).toFixed(2)} €</strong>
        </div>
        <div class="totals-row">
          <span>Συνολικός ΦΠΑ:</span>
          <strong>${Number(invoice.vatAmount).toFixed(2)} €</strong>
        </div>
        <div class="totals-row grand-total">
          <span>Πληρωτέο Ποσό:</span>
          <span>${Number(invoice.totalAmount).toFixed(2)} €</span>
        </div>
      </div>
    </div>

    <div class="footer-notes">
      <p>Το παρόν παραστατικό εκδόθηκε ηλεκτρονικά μέσω του Ελληνικού Συστήματος Τιμολόγησης / ERP.</p>
    </div>
  </div>

  ${req.query.autoprint === "1" ? "<script>window.addEventListener('load', () => window.print());</script>" : ""}
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Σφάλμα κατά την παραγωγή του παραστατικού</h1><pre>${error instanceof Error ? error.message : "Unknown error"}</pre>`);
  }
});


