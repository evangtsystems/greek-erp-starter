import express from "express";
import { customerRouter } from "./routes/customers.js";
import { invoiceSeriesRouter } from "./routes/invoice-series.js";
import { invoiceRouter } from "./routes/invoices.js";
import { organizationRouter } from "./routes/organizations.js";
import { productRouter } from "./routes/products.js";
import { providerCredentialRouter } from "./routes/provider-credentials.js";
import { vatRouter } from "./routes/vat.js";
import { wrappRouter } from "./routes/wrapp.js";

const app = express();

// Wrapp signs the exact raw JSON payload. This route must run before express.json().
app.use("/api/wrapp/webhooks", express.raw({ type: "application/json" }), wrappRouter);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/invoices", invoiceRouter);
app.use("/api/organizations", organizationRouter);
app.use("/api/customers", customerRouter);
app.use("/api/products", productRouter);
app.use("/api/invoice-series", invoiceSeriesRouter);
app.use("/api/provider-credentials", providerCredentialRouter);
app.use("/api/vat", vatRouter);
app.use("/api/wrapp", wrappRouter);

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`ERP API listening on http://localhost:${port}`);
});
