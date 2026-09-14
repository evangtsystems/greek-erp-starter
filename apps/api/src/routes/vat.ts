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
