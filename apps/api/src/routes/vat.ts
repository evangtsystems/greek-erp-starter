import { Router } from "express";
import { z } from "zod";

export const vatRouter = Router();

const lookupVatSchema = z.object({
  countryCode: z.string().min(2).max(2),
  vatNumber: z.string().min(4)
});

vatRouter.post("/lookup", async (req, res) => {
  const parsed = lookupVatSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const countryCode = parsed.data.countryCode.toUpperCase() === "GR"
    ? "EL"
    : parsed.data.countryCode.toUpperCase();
  const vatNumber = parsed.data.vatNumber.replace(/\s/g, "").replace(/^EL/i, "").replace(/^GR/i, "");

  try {
    const response = await fetch(
      "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, vatNumber })
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        error: `VIES returned ${response.status}`
      });
    }

    const data = await response.json();

    res.json({
      source: "VIES",
      countryCode,
      vatNumber,
      valid: Boolean(data.valid),
      name: typeof data.name === "string" && data.name !== "---" ? data.name : null,
      address: typeof data.address === "string" && data.address !== "---" ? data.address : null,
      requestDate: data.requestDate ?? null
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "VAT lookup failed"
    });
  }
});

const periodicReportQuerySchema = z.object({
  organizationId: z.string().uuid(),
  year: z.coerce.number().optional().default(new Date().getFullYear()),
  period: z.enum(["ALL", "Q1", "Q2", "Q3", "Q4", "YEAR", "CUSTOM"]).optional().default("ALL"),
  from: z.string().optional(),
  to: z.string().optional()
});

vatRouter.get("/periodic-report", async (req, res) => {
  const parsed = periodicReportQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { organizationId, year, period, from, to } = parsed.data;

  let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;

  if (period === "CUSTOM" && from && to) {
    dateFilter = { gte: new Date(from), lte: new Date(to) };
  } else if (period === "Q1") {
    dateFilter = { gte: new Date(year, 0, 1), lte: new Date(year, 2, 31, 23, 59, 59, 999) };
  } else if (period === "Q2") {
    dateFilter = { gte: new Date(year, 3, 1), lte: new Date(year, 5, 30, 23, 59, 59, 999) };
  } else if (period === "Q3") {
    dateFilter = { gte: new Date(year, 6, 1), lte: new Date(year, 8, 30, 23, 59, 59, 999) };
  } else if (period === "Q4") {
    dateFilter = { gte: new Date(year, 9, 1), lte: new Date(year, 11, 31, 23, 59, 59, 999) };
  } else if (period === "YEAR") {
    dateFilter = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59, 999) };
  }

  try {
    const { prisma } = await import("../../../../packages/database/src/client.js");

    const [invoices, purchases] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          organizationId,
          status: { in: ["ISSUED", "CREDITED"] },
          ...(dateFilter ? { issueDate: dateFilter } : {})
        },
        include: { lines: true }
      }),
      prisma.purchaseInvoice.findMany({
        where: {
          organizationId,
          ...(dateFilter ? { issueDate: dateFilter } : {})
        },
        include: { lines: true }
      })
    ]);

    let grossSalesNet = 0;
    let grossSalesVat = 0;
    let creditNotesNet = 0;
    let creditNotesVat = 0;

    const rateMap = new Map<number, { outputNet: number; outputVat: number; inputNet: number; inputVat: number }>();
    const getRateBucket = (rate: number) => {
      if (!rateMap.has(rate)) {
        rateMap.set(rate, { outputNet: 0, outputVat: 0, inputNet: 0, inputVat: 0 });
      }
      return rateMap.get(rate)!;
    };

    // Ensure standard VAT rates are present
    [24, 13, 6, 0].forEach((r) => getRateBucket(r));

    for (const inv of invoices) {
      const isCredit = inv.documentType === "5.1" || inv.documentType === "5.2";
      for (const line of inv.lines) {
        const net = Number(line.netValue);
        const vat = Number(line.vatAmount);
        const rate = Number(line.vatRate);
        const bucket = getRateBucket(rate);

        if (isCredit) {
          creditNotesNet += net;
          creditNotesVat += vat;
          bucket.outputNet -= net;
          bucket.outputVat -= vat;
        } else {
          grossSalesNet += net;
          grossSalesVat += vat;
          bucket.outputNet += net;
          bucket.outputVat += vat;
        }
      }
    }

    let purchasesNet = 0;
    let purchasesVat = 0;

    for (const p of purchases) {
      for (const line of p.lines) {
        const net = Number(line.netValue);
        const vat = Number(line.vatAmount);
        const rate = Number(line.vatRate);
        const bucket = getRateBucket(rate);

        purchasesNet += net;
        purchasesVat += vat;
        bucket.inputNet += net;
        bucket.inputVat += vat;
      }
    }

    const netSales = Number((grossSalesNet - creditNotesNet).toFixed(2));
    const outputVat = Number((grossSalesVat - creditNotesVat).toFixed(2));
    const totalPurchasesNet = Number(purchasesNet.toFixed(2));
    const totalPurchasesVat = Number(purchasesVat.toFixed(2));
    const vatBalance = Number((outputVat - totalPurchasesVat).toFixed(2));
    const grossProfit = Number((netSales - totalPurchasesNet).toFixed(2));

    const ratesSummary = Array.from(rateMap.entries())
      .map(([rate, vals]) => ({
        rate,
        outputNet: Number(vals.outputNet.toFixed(2)),
        outputVat: Number(vals.outputVat.toFixed(2)),
        inputNet: Number(vals.inputNet.toFixed(2)),
        inputVat: Number(vals.inputVat.toFixed(2)),
        balance: Number((vals.outputVat - vals.inputVat).toFixed(2))
      }))
      .sort((a, b) => b.rate - a.rate);

    res.json({
      period,
      year,
      dateRange: dateFilter
        ? { from: dateFilter.gte?.toISOString(), to: dateFilter.lte?.toISOString() }
        : null,
      summary: {
        grossSalesNet: Number(grossSalesNet.toFixed(2)),
        grossSalesVat: Number(grossSalesVat.toFixed(2)),
        creditNotesNet: Number(creditNotesNet.toFixed(2)),
        creditNotesVat: Number(creditNotesVat.toFixed(2)),
        netSales,
        outputVat,
        purchasesNet: totalPurchasesNet,
        inputVat: totalPurchasesVat,
        vatBalance,
        vatStatus: vatBalance > 0 ? "PAYABLE" : vatBalance < 0 ? "CREDIT" : "ZERO",
        vatBalanceLabel:
          vatBalance > 0
            ? "ΦΠΑ προς απόδοση"
            : vatBalance < 0
              ? "Πιστωτικό υπόλοιπο ΦΠΑ"
              : "Μηδενικό υπόλοιπο",
        grossProfit
      },
      ratesSummary,
      invoicesCount: invoices.length,
      purchasesCount: purchases.length
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Report calculation failed"
    });
  }
});

