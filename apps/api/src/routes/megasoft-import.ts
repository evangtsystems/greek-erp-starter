import { Router } from "express";
import sql from "mssql";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { requireErpAdmin } from "../services/erp-session.js";

export const megasoftImportRouter = Router();
megasoftImportRouter.use(requireErpAdmin);

const sourceSchema = z.object({
  server: z.string().min(1),
  port: z.coerce.number().int().positive().max(65535).default(1433),
  user: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  encrypt: z.boolean().default(false),
  trustServerCertificate: z.boolean().default(true)
});

const requestSchema = z.object({
  organizationId: z.string().uuid(),
  source: sourceSchema,
  profile: z.object({
    prefix: z.enum(["E1", "E2"]),
    slot: z.coerce.number().int().min(1).max(99)
  })
});

type ImportRequest = z.infer<typeof requestSchema>;

type ImportedCustomer = {
  externalCode: string;
  name: string;
  vatNumber: string | null;
  taxOffice: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
};

type ImportedProduct = {
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
  vatRate: number;
};

function tableNames(profile: ImportRequest["profile"]) {
  return {
    header: `[${profile.prefix}_Emp016_${profile.slot}]`,
    lines: `[${profile.prefix}_emp017_${profile.slot}]`
  };
}

function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function number(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

async function readSource(input: ImportRequest) {
  const tables = tableNames(input.profile);
  const pool = new sql.ConnectionPool({
    server: input.source.server,
    port: input.source.port,
    user: input.source.user,
    password: input.source.password,
    database: input.source.database,
    options: {
      encrypt: input.source.encrypt,
      trustServerCertificate: input.source.trustServerCertificate
    }
  });

  try {
    await pool.connect();

    const [customerCountResult, productCountResult, customerResult, productResult] = await Promise.all([
      pool.request().query(`
        SELECT COUNT(*) AS count
        FROM (
          SELECT [KwdPel]
          FROM ${tables.header}
          WHERE NULLIF(LTRIM(RTRIM([KwdPel])), '') IS NOT NULL
            AND NULLIF(LTRIM(RTRIM([PerPel])), '') IS NOT NULL
            AND ([Pel] = N'+' OR [Pel] IS NULL)
          GROUP BY [KwdPel]
        ) AS customers
      `),
      pool.request().query(`
        SELECT COUNT(*) AS count
        FROM (
          SELECT [KwdEidous]
          FROM ${tables.lines}
          WHERE NULLIF(LTRIM(RTRIM([KwdEidous])), '') IS NOT NULL
            AND NULLIF(LTRIM(RTRIM([PerEidous])), '') IS NOT NULL
          GROUP BY [KwdEidous]
        ) AS products
      `),
      pool.request().query(`
        SELECT [KwdPel] AS externalCode,
               MAX([PerPel]) AS name,
               MAX([AfmPel]) AS vatNumber,
               MAX([DoyPel]) AS taxOffice,
               MAX([AddressPel]) AS address,
               MAX([CityPel]) AS city,
               MAX([ZipPel]) AS postalCode,
               MAX([TelPel]) AS phone
        FROM ${tables.header}
        WHERE NULLIF(LTRIM(RTRIM([KwdPel])), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM([PerPel])), '') IS NOT NULL
          AND ([Pel] = N'+' OR [Pel] IS NULL)
        GROUP BY [KwdPel]
        ORDER BY [KwdPel]
      `),
      pool.request().query(`
        SELECT [KwdEidous] AS code,
               MAX([PerEidous]) AS name,
               MAX([MonadaMetrEidous]) AS unit,
               MAX([Timh]) AS unitPrice,
               MAX([ForosPososto]) AS vatRate
        FROM ${tables.lines}
        WHERE NULLIF(LTRIM(RTRIM([KwdEidous])), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM([PerEidous])), '') IS NOT NULL
        GROUP BY [KwdEidous]
        ORDER BY [KwdEidous]
      `)
    ]);

    return {
      customers: customerResult.recordset.map((row: Record<string, unknown>): ImportedCustomer => ({
        externalCode: text(row.externalCode) ?? "",
        name: text(row.name) ?? "Χωρίς επωνυμία",
        vatNumber: text(row.vatNumber),
        taxOffice: text(row.taxOffice),
        address: text(row.address),
        city: text(row.city),
        postalCode: text(row.postalCode),
        phone: text(row.phone)
      })).filter((row: ImportedCustomer) => row.externalCode && row.name),
      products: productResult.recordset.map((row: Record<string, unknown>): ImportedProduct => ({
        code: text(row.code) ?? "",
        name: text(row.name) ?? "Χωρίς περιγραφή",
        unit: text(row.unit) ?? "τεμάχιο",
        unitPrice: Math.max(0, number(row.unitPrice)),
        vatRate: Math.max(0, number(row.vatRate))
      })).filter((row: ImportedProduct) => row.code && row.name),
      counts: {
        customers: number(customerCountResult.recordset[0]?.count),
        products: number(productCountResult.recordset[0]?.count)
      }
    };
  } finally {
    await pool.close();
  }
}

megasoftImportRouter.post("/megasoft/preview", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const data = await readSource(parsed.data);
    return res.json({
      profile: parsed.data.profile,
      source: { database: parsed.data.source.database, server: parsed.data.source.server },
      counts: data.counts,
      samples: {
        customers: data.customers.slice(0, 10),
        products: data.products.slice(0, 10)
      }
    });
  } catch {
    return res.status(502).json({ error: "Δεν ήταν δυνατή η ανάγνωση από τη βάση Megasoft. Έλεγξε server, βάση, χρήστη και δικαιώματα ανάγνωσης." });
  }
});

megasoftImportRouter.post("/megasoft/execute", async (req, res) => {
  const parsed = requestSchema.extend({ confirm: z.literal(true) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Απαιτείται confirm: true και έγκυρα στοιχεία σύνδεσης." });

  try {
    const organization = await prisma.organization.findUnique({ where: { id: parsed.data.organizationId } });
    if (!organization) return res.status(404).json({ error: "Η επιχείρηση δεν βρέθηκε." });

    const data = await readSource(parsed.data);
    let customersImported = 0;
    let productsImported = 0;

    for (const customer of data.customers) {
      await prisma.customer.upsert({
        where: {
          organizationId_externalCode: {
            organizationId: parsed.data.organizationId,
            externalCode: customer.externalCode
          }
        },
        update: {
          name: customer.name,
          vatNumber: customer.vatNumber,
          taxOffice: customer.taxOffice,
          address: customer.address,
          city: customer.city,
          postalCode: customer.postalCode,
          phone: customer.phone
        },
        create: {
          organizationId: parsed.data.organizationId,
          externalCode: customer.externalCode,
          type: "BUSINESS",
          name: customer.name,
          vatNumber: customer.vatNumber,
          taxOffice: customer.taxOffice,
          address: customer.address,
          city: customer.city,
          postalCode: customer.postalCode,
          phone: customer.phone,
          country: "GR"
        }
      });
      customersImported += 1;
    }

    for (const product of data.products) {
      await prisma.product.upsert({
        where: {
          organizationId_code: {
            organizationId: parsed.data.organizationId,
            code: product.code
          }
        },
        update: {
          name: product.name,
          unit: product.unit,
          unitPrice: product.unitPrice,
          vatRate: product.vatRate,
          active: true
        },
        create: {
          organizationId: parsed.data.organizationId,
          code: product.code,
          name: product.name,
          unit: product.unit,
          unitPrice: product.unitPrice,
          vatRate: product.vatRate,
          active: true
        }
      });
      productsImported += 1;
    }

    return res.json({
      ok: true,
      imported: { customers: customersImported, products: productsImported },
      sourceCounts: data.counts
    });
  } catch {
    return res.status(502).json({ error: "Η εισαγωγή δεν ολοκληρώθηκε. Δεν έγινε αλλαγή στις πηγές Megasoft." });
  }
});
