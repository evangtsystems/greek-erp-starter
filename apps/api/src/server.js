"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var customers_js_1 = require("./routes/customers.js");
var invoice_series_js_1 = require("./routes/invoice-series.js");
var invoices_js_1 = require("./routes/invoices.js");
var organizations_js_1 = require("./routes/organizations.js");
var products_js_1 = require("./routes/products.js");
var vat_js_1 = require("./routes/vat.js");
var app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/health", function (_req, res) {
    res.json({ ok: true });
});
app.use("/api/invoices", invoices_js_1.invoiceRouter);
app.use("/api/organizations", organizations_js_1.organizationRouter);
app.use("/api/customers", customers_js_1.customerRouter);
app.use("/api/products", products_js_1.productRouter);
app.use("/api/invoice-series", invoice_series_js_1.invoiceSeriesRouter);
app.use("/api/vat", vat_js_1.vatRouter);
var port = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 4000);
app.listen(port, function () {
    console.log("ERP API listening on http://localhost:".concat(port));
});
