import { Router } from "express";
import { z } from "zod";
import { requireErpAdmin } from "../services/erp-session.js";

export const gemiRouter = Router();

const gemiBaseUrl = "https://opendata-api.businessportal.gr/api/opendata/v1";
const cacheTtlMs = 1000 * 60 * 60 * 12;
const requestWindowMs = 1000 * 60;
const requestLimit = 8;

type GemiCompany = {
  arGemi?: number | string;
  afm?: string;
  coNameEl?: string;
  coTitlesEl?: string[];
  city?: string;
  street?: string;
  streetNumber?: string;
  zipCode?: string;
  url?: string;
  email?: string;
  isBranch?: boolean;
  legalType?: { descr?: string };
  gemiOffice?: { descr?: string };
  status?: { descr?: string; isActive?: boolean };
};

type GemiResult = {
  source: "GEMI";
  valid: boolean;
  vatNumber: string;
  arGemi: string | null;
  name: string | null;
  title: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  email: string | null;
  website: string | null;
  gemiOffice: string | null;
  legalType: string | null;
  status: string | null;
  isActive: boolean | null;
  isBranch: boolean | null;
};

const cache = new Map<string, { expiresAt: number; value: GemiResult }>();
let requestTimestamps: number[] = [];

const lookupSchema = z.object({
  vatNumber: z.string().trim().min(1)
});

function normalizeVat(value: string) {
  return value.replace(/\s/g, "").replace(/^(EL|GR)/i, "");
}

function emptyResult(vatNumber: string): GemiResult {
  return {
    source: "GEMI",
    valid: false,
    vatNumber,
    arGemi: null,
    name: null,
    title: null,
    address: null,
    city: null,
    postalCode: null,
    email: null,
    website: null,
    gemiOffice: null,
    legalType: null,
    status: null,
    isActive: null,
    isBranch: null
  };
}

function buildResult(vatNumber: string, company: GemiCompany): GemiResult {
  const address = [company.street, company.streetNumber]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return {
    source: "GEMI",
    valid: true,
    vatNumber,
    arGemi: company.arGemi == null ? null : String(company.arGemi),
    name: company.coNameEl?.trim() || null,
    title: company.coTitlesEl?.find(Boolean)?.trim() || null,
    address: address || null,
    city: company.city?.trim() || null,
    postalCode: company.zipCode?.trim() || null,
    email: company.email?.trim() || null,
    website: company.url?.trim() || null,
    gemiOffice: company.gemiOffice?.descr?.trim() || null,
    legalType: company.legalType?.descr?.trim() || null,
    status: company.status?.descr?.trim() || null,
    isActive: typeof company.status?.isActive === "boolean" ? company.status.isActive : null,
    isBranch: typeof company.isBranch === "boolean" ? company.isBranch : null
  };
}

function consumeRequestSlot() {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((timestamp) => now - timestamp < requestWindowMs);

  if (requestTimestamps.length >= requestLimit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((requestTimestamps[0] + requestWindowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  requestTimestamps.push(now);
  return { allowed: true, retryAfterSeconds: 0 };
}

gemiRouter.get("/company", requireErpAdmin, async (req, res) => {
  const parsed = lookupSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: "Απαιτείται ΑΦΜ." });
  }

  const vatNumber = normalizeVat(parsed.data.vatNumber);
  if (!/^\d{9}$/.test(vatNumber)) {
    return res.status(400).json({ error: "Το ΑΦΜ πρέπει να έχει ακριβώς 9 ψηφία." });
  }

  const cached = cache.get(vatNumber);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ ...cached.value, cached: true });
  }

  const apiKey = process.env.GEMI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Δεν έχει ρυθμιστεί GEMI_API_KEY στο αρχείο .env του API."
    });
  }

  const slot = consumeRequestSlot();
  if (!slot.allowed) {
    res.setHeader("Retry-After", String(slot.retryAfterSeconds));
    return res.status(429).json({
      error: `Έχει συμπληρωθεί το όριο ΓΕΜΗ των ${requestLimit} αιτημάτων/λεπτό. Δοκιμάστε ξανά σε ${slot.retryAfterSeconds} δευτ.`
    });
  }

  try {
    const baseUrl = (process.env.GEMI_API_BASE_URL || gemiBaseUrl).replace(/\/$/, "");
    const url = new URL(`${baseUrl}/companies`);
    url.searchParams.set("afm", vatNumber);
    url.searchParams.set("resultsSize", "1");

    const response = await fetch(url, {
      headers: {
        api_key: apiKey,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(12_000)
    });

    if (response.status === 404) {
      const value = emptyResult(vatNumber);
      cache.set(vatNumber, { value, expiresAt: Date.now() + cacheTtlMs });
      return res.json({ ...value, cached: false });
    }

    if (!response.ok) {
      const detail = response.status === 401
        ? "Το GEMI_API_KEY δεν έγινε δεκτό από το ΓΕΜΗ."
        : `Το ΓΕΜΗ επέστρεψε σφάλμα ${response.status}.`;
      return res.status(502).json({ error: detail });
    }

    const payload = await response.json() as { searchResults?: GemiCompany[] };
    const company = payload.searchResults?.find((item) => normalizeVat(String(item.afm || "")) === vatNumber)
      ?? payload.searchResults?.[0];

    const value = company ? buildResult(vatNumber, company) : emptyResult(vatNumber);
    cache.set(vatNumber, { value, expiresAt: Date.now() + cacheTtlMs });
    res.json({ ...value, cached: false });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? `Αδυναμία επικοινωνίας με ΓΕΜΗ: ${error.message}` : "Αδυναμία επικοινωνίας με ΓΕΜΗ."
    });
  }
});
