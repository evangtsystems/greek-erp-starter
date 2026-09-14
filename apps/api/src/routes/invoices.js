"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceRouter = void 0;
var express_1 = require("express");
var zod_1 = require("zod");
var client_js_1 = require("../../../../packages/database/src/client.js");
exports.invoiceRouter = (0, express_1.Router)();
var organizationQuerySchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid()
});
var draftInvoiceSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid(),
    customerId: zod_1.z.string().uuid().nullable().optional(),
    seriesId: zod_1.z.string().uuid(),
    documentType: zod_1.z.string().min(1),
    lines: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.string().uuid().nullable().optional(),
        description: zod_1.z.string().min(1),
        quantity: zod_1.z.coerce.number().positive(),
        unitPrice: zod_1.z.coerce.number().nonnegative(),
        vatRate: zod_1.z.coerce.number().min(0)
    })).min(1)
});
exports.invoiceRouter.get("/", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var parsed, invoices;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                parsed = organizationQuerySchema.safeParse(req.query);
                if (!parsed.success) {
                    return [2 /*return*/, res.status(400).json({ error: parsed.error.flatten() })];
                }
                return [4 /*yield*/, client_js_1.prisma.invoice.findMany({
                        where: { organizationId: parsed.data.organizationId },
                        include: { customer: true, series: true, lines: true },
                        orderBy: { createdAt: "desc" }
                    })];
            case 1:
                invoices = _a.sent();
                res.json(invoices);
                return [2 /*return*/];
        }
    });
}); });
exports.invoiceRouter.post("/", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var parsed, data, lines, netAmount, vatAmount, invoice;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                parsed = draftInvoiceSchema.safeParse(req.body);
                if (!parsed.success) {
                    return [2 /*return*/, res.status(400).json({ error: parsed.error.flatten() })];
                }
                data = parsed.data;
                lines = data.lines.map(function (line, index) {
                    var _a;
                    var net = line.quantity * line.unitPrice;
                    var vat = net * (line.vatRate / 100);
                    return {
                        productId: (_a = line.productId) !== null && _a !== void 0 ? _a : null,
                        lineNo: index + 1,
                        description: line.description,
                        quantity: line.quantity,
                        unitPrice: line.unitPrice,
                        discountAmount: 0,
                        netValue: Number(net.toFixed(2)),
                        vatRate: line.vatRate,
                        vatAmount: Number(vat.toFixed(2)),
                        totalValue: Number((net + vat).toFixed(2))
                    };
                });
                netAmount = lines.reduce(function (sum, l) { return sum + l.netValue; }, 0);
                vatAmount = lines.reduce(function (sum, l) { return sum + l.vatAmount; }, 0);
                return [4 /*yield*/, client_js_1.prisma.invoice.create({
                        data: {
                            organizationId: data.organizationId,
                            customerId: (_a = data.customerId) !== null && _a !== void 0 ? _a : null,
                            seriesId: data.seriesId,
                            documentType: data.documentType,
                            netAmount: netAmount,
                            vatAmount: vatAmount,
                            totalAmount: netAmount + vatAmount,
                            lines: { create: lines }
                        },
                        include: { lines: true }
                    })];
            case 1:
                invoice = _b.sent();
                res.status(201).json(invoice);
                return [2 /*return*/];
        }
    });
}); });
exports.invoiceRouter.post("/:id/issue-local", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var invoiceId, organizationId, issued, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                invoiceId = req.params.id;
                organizationId = String((_a = req.body.organizationId) !== null && _a !== void 0 ? _a : "");
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                return [4 /*yield*/, client_js_1.prisma.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                        var invoice, updatedSeries, assignedNumber, updated;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, tx.invoice.findFirst({
                                        where: { id: invoiceId, organizationId: organizationId },
                                        include: { series: true }
                                    })];
                                case 1:
                                    invoice = _a.sent();
                                    if (!invoice)
                                        throw new Error("Invoice not found");
                                    if (invoice.status !== "DRAFT" && invoice.status !== "READY") {
                                        throw new Error("Invoice cannot be issued from ".concat(invoice.status));
                                    }
                                    return [4 /*yield*/, tx.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        UPDATE invoice_series\n        SET next_number = next_number + 1,\n            updated_at = NOW()\n        WHERE id = ", "\n          AND organization_id = ", "\n        RETURNING next_number\n      "], ["\n        UPDATE invoice_series\n        SET next_number = next_number + 1,\n            updated_at = NOW()\n        WHERE id = ", "\n          AND organization_id = ", "\n        RETURNING next_number\n      "])), invoice.seriesId, organizationId)];
                                case 2:
                                    updatedSeries = _a.sent();
                                    if (updatedSeries.length !== 1)
                                        throw new Error("Invoice series not found");
                                    assignedNumber = updatedSeries[0].next_number - 1;
                                    return [4 /*yield*/, tx.invoice.update({
                                            where: { id: invoice.id },
                                            data: {
                                                invoiceNumber: assignedNumber,
                                                issueDate: new Date(),
                                                status: "ISSUED",
                                                issuedAt: new Date(),
                                                providerStatus: "LOCAL_ONLY"
                                            },
                                            include: { lines: true, customer: true, series: true }
                                        })];
                                case 3:
                                    updated = _a.sent();
                                    return [4 /*yield*/, tx.auditLog.create({
                                            data: {
                                                organizationId: organizationId,
                                                entityType: "invoice",
                                                entityId: invoice.id,
                                                action: "ISSUE_LOCAL",
                                                newData: JSON.parse(JSON.stringify({
                                                    series: updated.series.code,
                                                    number: assignedNumber,
                                                    totalAmount: updated.totalAmount.toString()
                                                }))
                                            }
                                        })];
                                case 4:
                                    _a.sent();
                                    return [2 /*return*/, updated];
                            }
                        });
                    }); })];
            case 2:
                issued = _b.sent();
                res.json(issued);
                return [3 /*break*/, 4];
            case 3:
                error_1 = _b.sent();
                res.status(400).json({
                    error: error_1 instanceof Error ? error_1.message : "Unknown error"
                });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
var templateObject_1;
