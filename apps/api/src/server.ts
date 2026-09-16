import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { customerRouter } from "./routes/customers.js";
import { invoiceSeriesRouter } from "./routes/invoice-series.js";
import { invoiceRouter } from "./routes/invoices.js";
import { megasoftImportRouter } from "./routes/megasoft-import.js";
import { organizationRouter } from "./routes/organizations.js";
import { productRouter } from "./routes/products.js";
import { providerCredentialRouter } from "./routes/provider-credentials.js";
import { vatRouter } from "./routes/vat.js";
import { wrappRouter } from "./routes/wrapp.js";
import { warehouseRouter } from "./routes/warehouses.js";
import { inventoryRouter } from "./routes/inventory.js";
import { supplierRouter } from "./routes/suppliers.js";
import { purchaseRouter } from "./routes/purchases.js";
import { paymentRouter } from "./routes/payments.js";
import { quoteRouter } from "./routes/quotes.js";
import { orderRouter } from "./routes/orders.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
process.loadEnvFile(path.resolve(currentDir, "../../../.env"));

const app = express();

// Wrapp signs the exact raw JSON payload. Parse only this route as raw, before JSON parsing.
app.use("/api/wrapp/webhooks/user-created", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/invoices", invoiceRouter);
app.use("/api/purchases", purchaseRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/quotes", quoteRouter);
app.use("/api/orders", orderRouter);
app.use("/api/organizations", organizationRouter);
app.use("/api/customers", customerRouter);
app.use("/api/suppliers", supplierRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/products", productRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/warehouses", warehouseRouter);
app.use("/api/imports", megasoftImportRouter);
app.use("/api/invoice-series", invoiceSeriesRouter);
app.use("/api/provider-credentials", providerCredentialRouter);
app.use("/api/vat", vatRouter);
app.use("/api/wrapp", wrappRouter);

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`ERP API listening on http://localhost:${port}`);
});
