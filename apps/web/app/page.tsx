"use client";

import {
  ArrowRight,
  BadgePercent,
  Ban,
  Boxes,
  Building2,
  Calculator,
  CheckCircle2,
  Clock3,
  CreditCard,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  History,
  Landmark,
  Layers,
  LogIn,
  LogOut,
  Menu,
  Package,
  PackagePlus,
  PlugZap,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  X,
  Zap
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Organization = { id: string; name: string; country: string };
type Customer = { id: string; name: string; vatNumber: string | null };
type Supplier = { id: string; name: string; vatNumber: string | null; email?: string | null; phone?: string | null; address?: string | null; city?: string | null };
type Product = { id: string; code: string | null; name: string; description: string | null; unitPrice: string; vatRate: string; classificationType?: string | null; classificationCategory?: string | null; categoryId?: string | null; trackSerialNumbers?: boolean };
type StockSerial = { id: string; serialNumber: string; status: "AVAILABLE" | "RESERVED" | "SOLD" | "RETURNED" | "IN_REPAIR"; notes?: string | null };
type Warehouse = { id: string; code: string; name: string; address?: string | null; active: boolean };
type ProductCategory = { id: string; name: string; products: (Product & { serials: StockSerial[] })[] };
type ProductFamily = { id: string; name: string; categories: ProductCategory[] };
type InvoiceSeries = { id: string; code: string; documentType: string; nextNumber: number; providerBillingBookId?: string | null };
type Invoice = {
  id: string;
  invoiceNumber: number | null;
  documentType: string;
  status: string;
  netAmount: string;
  vatAmount: string;
  totalAmount: string;
  providerStatus: string | null;
  paymentStatus?: string;
  mydataMark?: string | null;
  mydataUid?: string | null;
  qrUrl?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  creditedInvoiceId?: string | null;
  creditedInvoice?: Invoice | null;
  customer: Customer | null;
  series: InvoiceSeries;
};
type Payment = {
  id: string;
  type: "CUSTOMER_RECEIPT" | "SUPPLIER_PAYMENT";
  amount: string | number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string | null;
  notes?: string | null;
  customer?: Customer | null;
  supplier?: Supplier | null;
  invoice?: (Invoice & { series: InvoiceSeries }) | null;
  purchaseInvoice?: PurchaseInvoice | null;
};
type CustomerLedgerEntry = {
  id: string;
  date: string;
  type: "INVOICE" | "CREDIT_NOTE" | "RECEIPT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};
type CustomerLedger = {
  customer: Customer;
  totalBilled: number;
  totalPaid: number;
  currentBalance: number;
  entries: CustomerLedgerEntry[];
};
type QuoteLine = {
  id: string;
  lineNo: number;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  netValue: string | number;
  vatRate: string | number;
  vatAmount: string | number;
  totalValue: string | number;
  product?: Product | null;
};
type Quote = {
  id: string;
  quoteNumber: string;
  status: string;
  issueDate: string;
  validUntil?: string | null;
  netAmount: string | number;
  vatAmount: string | number;
  totalAmount: string | number;
  notes?: string | null;
  convertedInvoiceId?: string | null;
  convertedOrderId?: string | null;
  customer?: Customer | null;
  lines: QuoteLine[];
};
type SalesOrder = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  netAmount: string | number;
  vatAmount: string | number;
  totalAmount: string | number;
  notes?: string | null;
  invoicedInvoiceId?: string | null;
  customer?: Customer | null;
  lines: QuoteLine[];
};
type VatRateSummary = {
  rate: number;
  outputNet: number;
  outputVat: number;
  inputNet: number;
  inputVat: number;
  balance: number;
};
type PeriodicVatReport = {
  period: string;
  year: number;
  dateRange: { from?: string; to?: string } | null;
  summary: {
    grossSalesNet: number;
    grossSalesVat: number;
    creditNotesNet: number;
    creditNotesVat: number;
    netSales: number;
    outputVat: number;
    purchasesNet: number;
    inputVat: number;
    vatBalance: number;
    vatStatus: "PAYABLE" | "CREDIT" | "ZERO";
    vatBalanceLabel: string;
    grossProfit: number;
  };
  ratesSummary: VatRateSummary[];
  invoicesCount: number;
  purchasesCount: number;
};
type PurchaseInvoiceLine = {
  id: string;
  lineNo: number;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  netValue: string | number;
  vatRate: string | number;
  vatAmount: string | number;
  totalValue: string | number;
  product?: Product | null;
};
type PurchaseInvoice = {
  id: string;
  documentNumber: string;
  documentType: string;
  issueDate: string;
  netAmount: string | number;
  vatAmount: string | number;
  totalAmount: string | number;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string | null;
  supplier: Supplier;
  lines: PurchaseInvoiceLine[];
};
type ProviderCredential = {
  id: string;
  provider: string;
  environment: string;
  enabled: boolean;
};
type InvoiceTemplate = { id: string; title: string; description: string; price: number; vatRate: number; classificationType: string; classificationCategory: string };

type StockBalance = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: string;
  vatRate: string;
  trackSerialNumbers: boolean;
  category: { id: string; name: string; familyName: string } | null;
  currentStock: number;
  availableSerialsCount: number;
  lastMovementAt: string | null;
};

type StockMovement = {
  id: string;
  organizationId: string;
  productId: string;
  type: "INITIAL" | "RECEIPT" | "SALE" | "ADJUSTMENT" | "RETURN" | "TRANSFER_OUT" | "TRANSFER_IN";
  quantity: string | number;
  unitCost: string | number | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  product: {
    id: string;
    code: string | null;
    name: string;
    unit: string;
  };
};

const invoiceTemplates: InvoiceTemplate[] = [
  { id: "service", title: "Παροχή υπηρεσίας", description: "Υπηρεσία", price: 100, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "product", title: "Πώληση προϊόντος", description: "Εμπόρευμα", price: 50, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "technical", title: "Τεχνική εργασία", description: "Τεχνική εργασία", price: 80, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "consulting", title: "Συμβουλευτική", description: "Υπηρεσίες συμβουλευτικής", price: 120, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "website", title: "Κατασκευή ιστοσελίδας", description: "Σχεδιασμός και ανάπτυξη ιστοσελίδας", price: 900, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "eshop", title: "Κατασκευή e-shop", description: "Σχεδιασμός και ανάπτυξη ηλεκτρονικού καταστήματος", price: 1500, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "maintenance", title: "Συντήρηση ιστοσελίδας", description: "Μηνιαία τεχνική συντήρηση και υποστήριξη", price: 80, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "hosting", title: "Φιλοξενία ιστοσελίδας", description: "Ετήσια φιλοξενία και τεχνική υποστήριξη", price: 120, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "domain", title: "Ανανέωση domain", description: "Ανανέωση ονόματος χώρου", price: 20, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "seo", title: "SEO και τοπική προβολή", description: "Βελτιστοποίηση μηχανών αναζήτησης", price: 250, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "integration", title: "Διασύνδεση / αυτοματοποίηση", description: "API, dashboard ή αυτοματοποίηση εργασιών", price: 300, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" }
];

const webTemplates = invoiceTemplates.filter((template) => ["website", "eshop", "maintenance", "hosting", "domain", "seo", "integration"].includes(template.id));
const basicTemplates = invoiceTemplates.filter((template) => !webTemplates.includes(template));

type VatLookup = {
  source: string;
  valid: boolean;
  name: string | null;
  address: string | null;
  countryCode: string;
  vatNumber: string;
};

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/erp-api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });

  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
};

const money = (value: string | number) =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(Number(value));

export default function Home() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [series, setSeries] = useState<InvoiceSeries[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [providerCredentials, setProviderCredentials] = useState<ProviderCredential[]>([]);
  const [message, setMessage] = useState("Έτοιμο");
  const [busy, setBusy] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [vatLookup, setVatLookup] = useState<VatLookup | null>(null);
  const [customerName, setCustomerName] = useState("Acme Greek Customer");
  const [customerVat, setCustomerVat] = useState("099999999");
  const [authenticated, setAuthenticated] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("service");
  const [templatePrice, setTemplatePrice] = useState(100);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [catalog, setCatalog] = useState<ProductFamily[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [movementWarehouseId, setMovementWarehouseId] = useState("");
  const [movementProductId, setMovementProductId] = useState("");
  const [movementType, setMovementType] = useState<"RECEIPT" | "INITIAL" | "ADJUSTMENT" | "SALE" | "RETURN">("RECEIPT");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("Alpha Wholesale Supplier");
  const [supplierVat, setSupplierVat] = useState("");
  const [supplierVatLookup, setSupplierVatLookup] = useState<VatLookup | null>(null);
  const [purchaseProductId, setPurchaseProductId] = useState("");
  const [purchaseDescription, setPurchaseDescription] = useState("");
  const [purchaseUnitPrice, setPurchaseUnitPrice] = useState(50);
  const [purchaseVatRate, setPurchaseVatRate] = useState(24);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [selectedPeriod, setSelectedPeriod] = useState<"ALL" | "Q1" | "Q2" | "Q3" | "Q4" | "YEAR">("ALL");
  const [vatReport, setVatReport] = useState<PeriodicVatReport | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [selectedLedgerCustomerId, setSelectedLedgerCustomerId] = useState("");
  const [customerLedger, setCustomerLedger] = useState<CustomerLedger | null>(null);

  // Payment form state
  const [paymentType, setPaymentType] = useState<"CUSTOMER_RECEIPT" | "SUPPLIER_PAYMENT">("CUSTOMER_RECEIPT");
  const [paymentTargetCustomerId, setPaymentTargetCustomerId] = useState("");
  const [paymentTargetSupplierId, setPaymentTargetSupplierId] = useState("");
  const [paymentTargetInvoiceId, setPaymentTargetInvoiceId] = useState("");
  const [paymentTargetPurchaseId, setPaymentTargetPurchaseId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(100);
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Quote form state
  const [quoteCustomerId, setQuoteCustomerId] = useState("");
  const [quoteProductId, setQuoteProductId] = useState("");
  const [quoteDescription, setQuoteDescription] = useState("");
  const [quoteQuantity, setQuoteQuantity] = useState(1);
  const [quoteUnitPrice, setQuoteUnitPrice] = useState(100);
  const [quoteVatRate, setQuoteVatRate] = useState(24);

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId]
  );
  const issuedInvoices = invoices.filter((invoice) => invoice.status === "ISSUED");
  const draftInvoices = invoices.filter((invoice) => invoice.status === "DRAFT" || invoice.status === "READY");
  const totalIssued = issuedInvoices.reduce((sum, invoice) => {
    const val = Number(invoice.totalAmount);
    return invoice.documentType === "5.1" || invoice.documentType === "5.2" ? sum - val : sum + val;
  }, 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
  const totalStockQuantity = stockBalances.reduce((sum, item) => sum + Number(item.currentStock), 0);
  const totalReceipts = payments.filter((p) => p.type === "CUSTOMER_RECEIPT").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalSupplierPayments = payments.filter((p) => p.type === "SUPPLIER_PAYMENT").reduce((sum, p) => sum + Number(p.amount), 0);

  const adminHeaders = (): HeadersInit => {
    if (!authenticated) throw new Error("Συνδέσου πρώτα στο ERP");
    return {};
  };

  const loadOrganizations = async () => {
    const data = await api<Organization[]>("/organizations");
    setOrganizations(data);
    setSelectedOrganizationId((current) => current || data[0]?.id || "");
  };

  const loadVatReport = async (organizationId: string, period = selectedPeriod) => {
    if (!organizationId) return;
    const data = await api<PeriodicVatReport>(`/vat/periodic-report?organizationId=${organizationId}&period=${period}&year=2026`);
    setVatReport(data);
  };

  const loadCustomerLedger = async (customerId: string, organizationId = selectedOrganizationId) => {
    if (!customerId || !organizationId) return;
    const data = await api<CustomerLedger>(`/payments/customer-ledger/${customerId}?organizationId=${organizationId}`);
    setCustomerLedger(data);
  };

  const loadInventory = async (organizationId: string) => {
    if (!organizationId) return;
    const [balancesData, movementsData, warehouseData] = await Promise.all([
      api<StockBalance[]>(`/inventory/balances?organizationId=${organizationId}`),
      api<StockMovement[]>(`/inventory/movements?organizationId=${organizationId}`),
      api<Warehouse[]>(`/warehouses?organizationId=${organizationId}`)
    ]);
    setStockBalances(balancesData);
    setStockMovements(movementsData);
    setWarehouses(warehouseData);
    setMovementWarehouseId((current) => current || warehouseData.find((item) => item.code === "MAIN")?.id || warehouseData[0]?.id || "");
    setMovementProductId((current) => current || balancesData[0]?.id || "");
  };

  const loadTenantData = async (organizationId: string) => {
    if (!organizationId) return;
    const [customerData, productData, seriesData, invoiceData, providerData, supplierData, purchaseData, paymentsData, quotesData, ordersData] = await Promise.all([
      api<Customer[]>(`/customers?organizationId=${organizationId}`),
      api<Product[]>(`/products?organizationId=${organizationId}`),
      api<InvoiceSeries[]>(`/invoice-series?organizationId=${organizationId}`),
      api<Invoice[]>(`/invoices?organizationId=${organizationId}`),
      api<ProviderCredential[]>(`/provider-credentials?organizationId=${organizationId}`),
      api<Supplier[]>(`/suppliers?organizationId=${organizationId}`),
      api<PurchaseInvoice[]>(`/purchases?organizationId=${organizationId}`),
      api<Payment[]>(`/payments?organizationId=${organizationId}`),
      api<Quote[]>(`/quotes?organizationId=${organizationId}`),
      api<SalesOrder[]>(`/orders?organizationId=${organizationId}`)
    ]);
    setCustomers(customerData);
    setProducts(productData);
    setSeries(seriesData);
    setSuppliers(supplierData);
    setPurchases(purchaseData);
    setPayments(paymentsData);
    setQuotes(quotesData);
    setOrders(ordersData);

    const firstCustId = customerData[0]?.id || "";
    setSelectedCustomerId((current) => current || firstCustId);
    setSelectedLedgerCustomerId((current) => current || firstCustId);
    setPaymentTargetCustomerId((current) => current || firstCustId);
    setQuoteCustomerId((current) => current || firstCustId);

    setSelectedSeriesId((current) => current || seriesData[0]?.id || "");
    const firstSuppId = supplierData[0]?.id || "";
    setSelectedSupplierId((current) => current || firstSuppId);
    setPaymentTargetSupplierId((current) => current || firstSuppId);

    setInvoices(invoiceData);
    setProviderCredentials(providerData);

    await Promise.all([
      loadInventory(organizationId).catch(() => {}),
      loadVatReport(organizationId, selectedPeriod).catch(() => {}),
      firstCustId ? loadCustomerLedger(firstCustId, organizationId).catch(() => {}) : Promise.resolve()
    ]);
  };

  useEffect(() => {
    loadOrganizations().catch((error) => setMessage(error.message));
    api<{ authenticated: boolean }>("/auth/session").then((data) => setAuthenticated(data.authenticated)).catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    loadTenantData(selectedOrganizationId).catch((error) => setMessage(error.message));
  }, [selectedOrganizationId]);

  useEffect(() => {
    loadVatReport(selectedOrganizationId, selectedPeriod).catch(() => {});
  }, [selectedOrganizationId, selectedPeriod]);

  const loadCatalog = async (organizationId: string) => {
    if (!organizationId || !authenticated) return;
    const data = await api<ProductFamily[]>(`/catalog?organizationId=${organizationId}`, { headers: adminHeaders() });
    setCatalog(data);
    setSelectedCategoryId((current) => current || data[0]?.categories[0]?.id || "");
  };

  useEffect(() => {
    loadCatalog(selectedOrganizationId).catch((error) => setMessage(error.message));
  }, [selectedOrganizationId, authenticated]);

  const runAction = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setMessage("Επεξεργασία...");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Παρουσιάστηκε σφάλμα");
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    await api("/auth/login", { method: "POST", body: JSON.stringify({ password: loginPassword }) });
    setAuthenticated(true);
    setLoginPassword("");
    await loadCatalog(selectedOrganizationId);
  };

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setCatalog([]);
  };

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const organization = await api<Organization>("/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        vatNumber: form.get("vatNumber") || null,
        taxOffice: form.get("taxOffice") || null,
        address: form.get("address") || null,
        city: form.get("city") || null,
        postalCode: form.get("postalCode") || null,
        country: form.get("country")
      })
    });
    event.currentTarget.reset();
    await loadOrganizations();
    setSelectedOrganizationId(organization.id);
  };

  const lookupVat = async () => {
    const result = await api<VatLookup>("/vat/lookup", {
      method: "POST",
      body: JSON.stringify({ countryCode: "EL", vatNumber: customerVat })
    });
    setVatLookup(result);
    if (result.name) setCustomerName(result.name);
  };

  const createCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await api<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        type: "BUSINESS",
        name: customerName,
        vatNumber: customerVat || null,
        country: "GR"
      })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const lookupSupplierVat = async () => {
    const result = await api<VatLookup>("/vat/lookup", {
      method: "POST",
      body: JSON.stringify({ countryCode: "EL", vatNumber: supplierVat })
    });
    setSupplierVatLookup(result);
    if (result.name) setSupplierName(result.name);
  };

  const createSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await api<Supplier>("/suppliers", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        name: supplierName,
        vatNumber: supplierVat || null,
        country: "GR"
      })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const createPurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const prod = products.find((p) => p.id === purchaseProductId);
    await api<PurchaseInvoice>("/purchases", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        warehouseId: form.get("warehouseId") || undefined,
        supplierId: form.get("supplierId"),
        documentNumber: form.get("documentNumber"),
        documentType: form.get("documentType") || "14.1",
        issueDate: form.get("issueDate") ? new Date(String(form.get("issueDate"))) : new Date(),
        paymentMethod: form.get("paymentMethod") || "BANK_TRANSFER",
        lines: [
          {
            productId: prod?.id || null,
            description: purchaseDescription || prod?.name || "Αγορά εμπορευμάτων / εξόδου",
            quantity: Number(purchaseQuantity),
            unitPrice: Number(purchaseUnitPrice),
            vatRate: Number(purchaseVatRate)
          }
        ]
      })
    });
    event.currentTarget.reset();
    setPurchaseDescription("");
    await Promise.all([loadTenantData(selectedOrganizationId), loadInventory(selectedOrganizationId)]);
  };

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<Product>("/products", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        code: form.get("code") || null,
        name: form.get("name"),
        unit: "τεμάχιο",
        unitPrice: Number(form.get("unitPrice")),
        vatRate: Number(form.get("vatRate")),
        categoryId: form.get("categoryId") || null,
        trackSerialNumbers: form.get("trackSerialNumbers") === "on",
        classificationType: "E3_561_001",
        classificationCategory: "category1_1"
      })
    });
    await Promise.all([loadTenantData(selectedOrganizationId), loadCatalog(selectedOrganizationId)]);
  };

  const createFamily = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/catalog/families", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ organizationId: selectedOrganizationId, name: form.get("name") }) });
    event.currentTarget.reset();
    await loadCatalog(selectedOrganizationId);
  };

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/catalog/categories", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ organizationId: selectedOrganizationId, familyId: form.get("familyId"), name: form.get("name") }) });
    event.currentTarget.reset();
    await loadCatalog(selectedOrganizationId);
  };

  const addSerial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api("/catalog/serials", { method: "POST", headers: adminHeaders(), body: JSON.stringify({ organizationId: selectedOrganizationId, productId: form.get("productId"), serialNumber: form.get("serialNumber"), notes: form.get("notes") || undefined }) });
    event.currentTarget.reset();
    await loadCatalog(selectedOrganizationId);
  };

  const createStockMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<StockMovement>("/inventory/movements", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        warehouseId: form.get("warehouseId"),
        productId: form.get("productId"),
        type: form.get("type"),
        quantity: Number(form.get("quantity")),
        unitCost: form.get("unitCost") ? Number(form.get("unitCost")) : null,
        reference: form.get("reference") || null,
        notes: form.get("notes") || null,
        serialNumbers: String(form.get("serialNumbers") || "").split(/[\\n,]/).map((value) => value.trim()).filter(Boolean)
      })
    });
    event.currentTarget.reset();
    await Promise.all([loadInventory(selectedOrganizationId), loadTenantData(selectedOrganizationId)]);
  };

  const transferStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<StockMovement[]>("/inventory/transfers", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        productId: form.get("productId"),
        fromWarehouseId: form.get("fromWarehouseId"),
        toWarehouseId: form.get("toWarehouseId"),
        quantity: Number(form.get("quantity")),
        reference: form.get("reference") || null,
        notes: form.get("notes") || null,
        serialNumbers: String(form.get("serialNumbers") || "").split(/[\\n,]/).map((value) => value.trim()).filter(Boolean)
      })
    });
    event.currentTarget.reset();
    await loadInventory(selectedOrganizationId);
  };

  const createWarehouse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<Warehouse>("/warehouses", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        code: form.get("code"),
        name: form.get("name"),
        address: form.get("address") || null,
        active: true
      })
    });
    event.currentTarget.reset();
    await loadInventory(selectedOrganizationId);
  };

  const createSeries = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<InvoiceSeries>("/invoice-series", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        code: form.get("code"),
        documentType: form.get("documentType"),
        nextNumber: Number(form.get("nextNumber")),
        providerBillingBookId: form.get("providerBillingBookId") || null
      })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const saveProviderCredential = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<ProviderCredential>("/provider-credentials", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        provider: form.get("provider"),
        environment: form.get("environment"),
        enabled: true,
        credentials: {
          apiKey: form.get("apiKey") || "sandbox-placeholder"
        },
        metadata: {
          displayName: form.get("provider")
        }
      })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const checkReadiness = async (invoiceId: string) => {
    const result = await api<{ readiness: { ready: boolean; errors: string[]; warnings: string[] } }>(
      `/invoices/${invoiceId}/readiness?organizationId=${selectedOrganizationId}`
    );
    const errors = result.readiness.errors.length;
    const warnings = result.readiness.warnings.length;
    setMessage(result.readiness.ready ? `Provider ready with ${warnings} warning(s)` : `Not ready: ${errors} error(s)`);
  };

  const queueProviderIssue = async (invoiceId: string) => {
    await api(`/invoices/${invoiceId}/issue-provider`, {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        provider: providerCredentials[0]?.provider
      })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const addDefaultTemplates = async () => {
    if (!selectedOrganizationId) throw new Error("Επίλεξε επιχείρηση πρώτα");
    adminHeaders();
    for (const template of invoiceTemplates) {
      if (products.some((product) => product.code === `TPL-${template.id}`)) continue;
      await api<Product>("/products", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ organizationId: selectedOrganizationId, code: `TPL-${template.id}`, name: template.title, description: template.description, unit: "τεμάχιο", unitPrice: template.price, vatRate: template.vatRate, classificationType: template.classificationType, classificationCategory: template.classificationCategory })
      });
    }
    await loadTenantData(selectedOrganizationId);
  };

  const createDraftInvoice = async () => {
    const customer = customers.find((item) => item.id === selectedCustomerId);
    const template = invoiceTemplates.find((item) => item.id === selectedTemplateId);
    const savedProduct = products.find((item) => item.id === selectedProductId);
    const firstSeries = series.find((item) => item.id === selectedSeriesId);
    if (!customer || (!template && !savedProduct) || !firstSeries) throw new Error("Διάλεξε πελάτη και σειρά παραστατικών");

    await api<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        customerId: customer.id,
        seriesId: firstSeries.id,
        documentType: firstSeries.documentType,
        lines: [{ productId: savedProduct?.id, description: savedProduct?.description || savedProduct?.name || template!.description, quantity: 1, unitPrice: savedProduct ? Number(savedProduct.unitPrice) : templatePrice, vatRate: savedProduct ? Number(savedProduct.vatRate) : template!.vatRate, vatCategory: "VAT_24", classificationType: savedProduct?.classificationType || template!.classificationType, classificationCategory: savedProduct?.classificationCategory || template!.classificationCategory }]
      })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const issueWrappStaging = async (invoiceId: string) => {
    if (!authenticated) throw new Error("Συνδέσου πρώτα στο ERP");
    await api(`/invoices/${invoiceId}/issue-wrapp-staging`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ organizationId: selectedOrganizationId })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const issueInvoice = async (invoiceId: string) => {
    await api<Invoice>(`/invoices/${invoiceId}/issue-local`, {
      method: "POST",
      body: JSON.stringify({ organizationId: selectedOrganizationId })
    });
    await Promise.all([loadTenantData(selectedOrganizationId), loadInventory(selectedOrganizationId)]);
  };

  const cancelInvoice = async (invoiceId: string) => {
    const reason = window.prompt("Αιτιολογία Ακύρωσης Παραστατικού (προαιρετικό):", "Ακύρωση μετά από αίτημα πελάτη");
    if (reason === null) return;
    await api(`/invoices/${invoiceId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ organizationId: selectedOrganizationId, reason })
    });
    await Promise.all([loadTenantData(selectedOrganizationId), loadInventory(selectedOrganizationId)]);
  };

  const issueCreditNote = async (invoiceId: string) => {
    const reason = window.prompt("Αιτιολογία Έκδοσης Πιστωτικού Τιμολογίου:", "Επιστροφή προϊόντων / Διόρθωση χρέωσης");
    if (reason === null) return;
    await api(`/invoices/${invoiceId}/credit-note`, {
      method: "POST",
      body: JSON.stringify({ organizationId: selectedOrganizationId, reason })
    });
    await Promise.all([loadTenantData(selectedOrganizationId), loadInventory(selectedOrganizationId)]);
  };

  const createPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await api<Payment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        type: paymentType,
        customerId: paymentType === "CUSTOMER_RECEIPT" ? (paymentTargetCustomerId || null) : null,
        supplierId: paymentType === "SUPPLIER_PAYMENT" ? (paymentTargetSupplierId || null) : null,
        invoiceId: paymentType === "CUSTOMER_RECEIPT" && paymentTargetInvoiceId ? paymentTargetInvoiceId : null,
        purchaseInvoiceId: paymentType === "SUPPLIER_PAYMENT" && paymentTargetPurchaseId ? paymentTargetPurchaseId : null,
        amount: Number(paymentAmount),
        paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null
      })
    });
    setPaymentReference("");
    setPaymentNotes("");
    await loadTenantData(selectedOrganizationId);
  };

  const createQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prod = products.find((p) => p.id === quoteProductId);
    await api<Quote>("/quotes", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        customerId: quoteCustomerId || null,
        notes: quoteDescription || null,
        lines: [
          {
            productId: prod?.id || null,
            description: quoteDescription || prod?.name || "Υπηρεσία / Εμπόρευμα",
            quantity: Number(quoteQuantity),
            unitPrice: Number(quoteUnitPrice),
            vatRate: Number(quoteVatRate)
          }
        ]
      })
    });
    setQuoteDescription("");
    await loadTenantData(selectedOrganizationId);
  };

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prod = products.find((p) => p.id === quoteProductId);
    await api<SalesOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        customerId: quoteCustomerId || null,
        notes: quoteDescription || null,
        lines: [
          {
            productId: prod?.id || null,
            description: quoteDescription || prod?.name || "Παραγγελία εμπορευμάτων / υπηρεσίας",
            quantity: Number(quoteQuantity),
            unitPrice: Number(quoteUnitPrice),
            vatRate: Number(quoteVatRate)
          }
        ]
      })
    });
    setQuoteDescription("");
    await loadTenantData(selectedOrganizationId);
  };

  const convertQuoteToInvoice = async (quoteId: string) => {
    await api<Invoice>(`/quotes/${quoteId}/convert-to-invoice`, {
      method: "POST",
      body: JSON.stringify({ organizationId: selectedOrganizationId, seriesId: selectedSeriesId || undefined })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const convertQuoteToOrder = async (quoteId: string) => {
    await api<SalesOrder>(`/quotes/${quoteId}/convert-to-order`, {
      method: "POST",
      body: JSON.stringify({ organizationId: selectedOrganizationId })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const convertOrderToInvoice = async (orderId: string) => {
    await api<Invoice>(`/orders/${orderId}/convert-to-invoice`, {
      method: "POST",
      body: JSON.stringify({ organizationId: selectedOrganizationId, seriesId: selectedSeriesId || undefined })
    });
    await loadTenantData(selectedOrganizationId);
  };

  return (
    <main className="workspace">
      {/* Mobile Top Header with Hamburger */}
      <header className="mobile-header">
        <div className="brand">
          <div className="brand-mark">
            <Landmark size={20} />
          </div>
          <div>
            <strong>Ελληνικό ERP</strong>
            <span>{selectedOrganization?.name || "Τιμολόγηση"}</span>
          </div>
        </div>
        <button
          type="button"
          className="hamburger-btn"
          aria-label="Μενού"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop Sidebar & Mobile Drawer) */}
      <aside className={`sidebar ${mobileMenuOpen ? "drawer-open" : ""}`}>
        <div className="brand desktop-brand">
          <div className="brand-mark">
            <Landmark size={23} />
          </div>
          <div>
            <strong>Ελληνικό ERP</strong>
            <span>Τιμολόγηση</span>
          </div>
        </div>

        <div className="mobile-drawer-header">
          <div className="brand">
            <div className="brand-mark">
              <Landmark size={22} />
            </div>
            <div>
              <strong>Ελληνικό ERP</strong>
              <span>Μενού Πλοήγησης</span>
            </div>
          </div>
          <button
            type="button"
            className="secondary drawer-close-btn"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav>
          <a href="#overview" onClick={() => setMobileMenuOpen(false)}><ReceiptText size={18} />Επισκόπηση</a>
          <a href="#financials" onClick={() => setMobileMenuOpen(false)}><Calculator size={18} />Περιοδική ΦΠΑ</a>
          <a href="#ledgers" onClick={() => setMobileMenuOpen(false)}><BadgePercent size={18} />Εισπράξεις & Καρτέλες</a>
          <a href="#quotes-orders" onClick={() => setMobileMenuOpen(false)}><FileSpreadsheet size={18} />Προσφορές & Παραγγελίες</a>
          <a href="#customers" onClick={() => setMobileMenuOpen(false)}><Users size={18} />Πελάτες</a>
          <a href="#suppliers" onClick={() => setMobileMenuOpen(false)}><Truck size={18} />Προμηθευτές</a>
          <a href="#purchases-form" onClick={() => setMobileMenuOpen(false)}><ShoppingCart size={18} />Αγορές & Έξοδα</a>
          <a href="#products" onClick={() => setMobileMenuOpen(false)}><Package size={18} />Προϊόντα & Κατάλογος</a>
          <a href="#inventory" onClick={() => setMobileMenuOpen(false)}><Boxes size={18} />Αποθήκη & Stock</a>
          <a href="#invoices" onClick={() => setMobileMenuOpen(false)}><FileText size={18} />Παραστατικά</a>
        </nav>

        <div className="sidebar-auth-card">
          {authenticated ? (
            <div>
              <div className="auth-badge">
                <ShieldCheck size={16} color="#1f6b45" />
                <span>Συνδεδεμένος στο ERP</span>
              </div>
              <button
                type="button"
                className="secondary auth-logout-btn"
                disabled={busy}
                onClick={() => {
                  setMobileMenuOpen(false);
                  runAction(logout, "Έγινε αποσύνδεση");
                }}
              >
                <LogOut size={16} />Αποσύνδεση
              </button>
            </div>
          ) : (
            <div className="auth-login-form">
              <label>
                Κωδικός ERP
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Κωδικός από .env..."
                />
              </label>
              <button
                type="button"
                className="auth-login-btn"
                disabled={busy || !loginPassword}
                onClick={() => {
                  setMobileMenuOpen(false);
                  runAction(login, "Συνδέθηκες στο ERP");
                }}
              >
                <LogIn size={16} />Σύνδεση
              </button>
            </div>
          )}
        </div>

        <div className="sidebar-note desktop-brand">
          <span>Ροή myDATA</span>
          <strong>ERP · Πάροχος · ΑΑΔΕ</strong>
        </div>
      </aside>

      <section className="content">
        <header className="hero" id="overview">
          <div>
            <span className="eyebrow">Χώρος εργασίας</span>
            <h1>{selectedOrganization?.name || "Ελληνικό ERP"}</h1>
            <p>Έκδοση παραστατικών, αρίθμηση, αγορές και ασφαλής διαβίβαση.</p>
            <div className="hero-insights">
              <div><ShieldCheck size={18} /><span>Σύνδεση παρόχου</span></div>
              <div><Clock3 size={18} /><span>Ασφαλής αποστολή</span></div>
              <div><TrendingUp size={18} /><span>{money(totalIssued)} πωλήσεις</span></div>
            </div>
          </div>
          <div className="tenant-card">
            <span>Ενεργή επιχείρηση</span>
            <select value={selectedOrganizationId} onChange={(event) => setSelectedOrganizationId(event.target.value)}>
              <option value="">Επιλογή επιχείρησης</option>
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <div className="system-state"><CheckCircle2 size={17} />{message}</div>
          </div>
        </header>

        <section className="metrics">
          <Metric icon={<Users />} label="Πελάτες" value={customers.length} />
          <Metric icon={<Truck />} label="Προμηθευτές" value={suppliers.length} />
          <Metric icon={<Package />} label="Προϊόντα" value={products.length} />
          <Metric icon={<Boxes />} label="Σύνολο Αποθέματος" value={`${totalStockQuantity} τεμ.`} />
          <Metric icon={<ShoppingCart />} label="Σύνολο Αγορών" value={money(totalPurchases)} />
          <Metric icon={<ReceiptText />} label="Σύνολο Πωλήσεων" value={money(totalIssued)} />
        </section>

        <section className="inventory-section" id="financials">
          <div className="section-title">
            <div>
              <span className="eyebrow">Φορολογικό Ισοζύγιο & myDATA</span>
              <h2>Περιοδική Εκκαθάριση ΦΠΑ & Αποτέλεσμα</h2>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["ALL", "Q1", "Q2", "Q3", "Q4", "YEAR"] as const).map((p) => {
                const labels: Record<string, string> = {
                  ALL: "Όλα",
                  Q1: "Α' Τρίμηνο (Q1)",
                  Q2: "Β' Τρίμηνο (Q2)",
                  Q3: "Γ' Τρίμηνο (Q3)",
                  Q4: "Δ' Τρίμηνο (Q4)",
                  YEAR: "Έτος 2026"
                };
                return (
                  <button
                    key={p}
                    type="button"
                    className={selectedPeriod === p ? "" : "secondary"}
                    style={{ minHeight: 32, padding: "0 10px", fontSize: 12 }}
                    onClick={() => setSelectedPeriod(p)}
                  >
                    {labels[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {vatReport ? (
            <>
              <div className="metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <div className="metric">
                  <div><TrendingUp size={22} color="#1f6b45" /></div>
                  <span>Έσοδα / Εκροές</span>
                  <strong>{money(vatReport.summary.netSales)}</strong>
                  <small style={{ color: "var(--muted)", fontSize: 11 }}>
                    ΦΠΑ Εκροών: {money(vatReport.summary.outputVat)}
                  </small>
                </div>

                <div className="metric">
                  <div><ShoppingCart size={22} color="#bd8427" /></div>
                  <span>Έξοδα / Εισροές</span>
                  <strong>{money(vatReport.summary.purchasesNet)}</strong>
                  <small style={{ color: "var(--muted)", fontSize: 11 }}>
                    ΦΠΑ Εισροών: {money(vatReport.summary.inputVat)}
                  </small>
                </div>

                <div className="metric" style={{ borderColor: vatReport.summary.vatBalance > 0 ? "var(--danger)" : "#1f6b45" }}>
                  <div><Scale size={22} color={vatReport.summary.vatBalance > 0 ? "var(--danger)" : "#1f6b45"} /></div>
                  <span>{vatReport.summary.vatBalanceLabel}</span>
                  <strong style={{ color: vatReport.summary.vatBalance > 0 ? "var(--danger)" : "#1f6b45" }}>
                    {money(Math.abs(vatReport.summary.vatBalance))}
                  </strong>
                  <small style={{ color: "var(--muted)", fontSize: 11 }}>
                    {vatReport.summary.vatStatus === "PAYABLE"
                      ? "Υποχρέωση καταβολής στο κράτος"
                      : vatReport.summary.vatStatus === "CREDIT"
                        ? "Πιστωτικό υπόλοιπο προς συμψηφισμό"
                        : "Ισοσκελισμένο"}
                  </small>
                </div>

                <div className="metric">
                  <div><ReceiptText size={22} color="#0f766e" /></div>
                  <span>Μικτό Αποτέλεσμα</span>
                  <strong style={{ color: vatReport.summary.grossProfit >= 0 ? "#1f6b45" : "var(--danger)" }}>
                    {money(vatReport.summary.grossProfit)}
                  </strong>
                  <small style={{ color: "var(--muted)", fontSize: 11 }}>
                    {vatReport.invoicesCount} πωλήσεις · {vatReport.purchasesCount} αγορές
                  </small>
                </div>
              </div>

              <div className="data-table-container" style={{ marginTop: 14 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Συντελεστής ΦΠΑ</th>
                      <th style={{ textAlign: "right" }}>Εκροές (Καθαρή Αξία)</th>
                      <th style={{ textAlign: "right" }}>ΦΠΑ Εκροών</th>
                      <th style={{ textAlign: "right" }}>Εισροές (Καθαρή Αξία)</th>
                      <th style={{ textAlign: "right" }}>ΦΠΑ Εισροών</th>
                      <th style={{ textAlign: "right" }}>Ισοζύγιο ΦΠΑ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatReport.ratesSummary.map((row) => (
                      <tr key={row.rate}>
                        <td><strong>ΦΠΑ {row.rate}%</strong></td>
                        <td style={{ textAlign: "right" }}>{money(row.outputNet)}</td>
                        <td style={{ textAlign: "right", color: "#1f6b45" }}>{money(row.outputVat)}</td>
                        <td style={{ textAlign: "right" }}>{money(row.inputNet)}</td>
                        <td style={{ textAlign: "right", color: "#bd8427" }}>{money(row.inputVat)}</td>
                        <td style={{ textAlign: "right" }}>
                          <strong style={{ color: row.balance > 0 ? "var(--danger)" : row.balance < 0 ? "#1f6b45" : "inherit" }}>
                            {row.balance > 0 ? `+${money(row.balance)}` : money(row.balance)}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty">Φόρτωση οικονομικών στοιχείων...</div>
          )}
        </section>

        <section className="template-panel">
          <div><span className="eyebrow">Γρήγορη έκδοση</span><h2>Τι θέλεις να τιμολογήσεις;</h2><p>Διάλεξε πρότυπο. Οι φορολογικές προεπιλογές συμπληρώνονται αυτόματα.</p><button className="secondary" disabled={busy || !selectedOrganizationId || !authenticated} onClick={() => runAction(addDefaultTemplates, "Τα έτοιμα πρότυπα προστέθηκαν")}><Package size={17} />Προσθήκη έτοιμων προτύπων</button></div>
          <div className="template-grid">{basicTemplates.map((template) => <button type="button" key={template.id} className={selectedTemplateId === template.id ? "template-card selected" : "template-card"} onClick={() => { setSelectedTemplateId(template.id); setSelectedProductId(""); setTemplatePrice(template.price); }}><strong>{template.title}</strong><span>{template.description}</span><small>ΦΠΑ {template.vatRate}%</small></button>)}</div>
          <label className="wide">Ιστοσελίδες και ψηφιακές υπηρεσίες<select value={webTemplates.some((template) => template.id === selectedTemplateId) ? selectedTemplateId : ""} onChange={(event) => { const template = webTemplates.find((item) => item.id === event.target.value); if (template) { setSelectedTemplateId(template.id); setSelectedProductId(""); setTemplatePrice(template.price); } }}><option value="">Επιλογή υπηρεσίας ιστοσελίδας</option>{webTemplates.map((template) => <option key={template.id} value={template.id}>{template.title} · {money(template.price)}</option>)}</select></label>
          {products.length > 0 ? <><span className="eyebrow">Τα αποθηκευμένα πρότυπά μου</span><div className="template-grid">{products.map((product) => <button type="button" key={product.id} className={selectedProductId === product.id ? "template-card selected" : "template-card"} onClick={() => { setSelectedProductId(product.id); setSelectedTemplateId(""); setTemplatePrice(Number(product.unitPrice)); }}><strong>{product.name}</strong><span>{product.description || product.code || "Πρότυπο προϊόντος/υπηρεσίας"}</span><small>ΦΠΑ {product.vatRate}%</small></button>)}</div></> : null}
          <div className="template-actions"><label>Πελάτης<select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}><option value="">Επιλογή πελάτη</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label><label>Σειρά<select value={selectedSeriesId} onChange={(event) => setSelectedSeriesId(event.target.value)}><option value="">Επιλογή σειράς</option>{series.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.documentType}</option>)}</select></label><label>Τιμή χωρίς ΦΠΑ<input type="number" min="0" step="0.01" value={templatePrice} onChange={(event) => setTemplatePrice(Number(event.target.value))} /></label><button disabled={busy || !selectedOrganizationId || !selectedCustomerId || !selectedSeriesId} onClick={() => runAction(createDraftInvoice, "Το πρόχειρο δημιουργήθηκε")}><FilePlus2 size={18} />Δημιουργία draft</button></div>
        </section>

        <section className="command-strip">
          <button className="secondary" disabled={busy || !selectedOrganizationId} onClick={() => runAction(createDraftInvoice, "Το πρόχειρο δημιουργήθηκε")}>
            <FilePlus2 size={18} />Νέο πρόχειρο
          </button>
          <button className="secondary" disabled={busy || !selectedOrganizationId} onClick={() => runAction(() => loadTenantData(selectedOrganizationId), "Τα δεδομένα ανανεώθηκαν")}>
            <RefreshCw size={18} />Ανανέωση
          </button>
        </section>

        <section className="board">
          <Panel title="Επιχείρηση" icon={<Building2 size={19} />}>
            <form className="form-grid" onSubmit={(event) => runAction(() => createOrganization(event), "Η επιχείρηση αποθηκεύτηκε")}>
              <label className="wide">Επωνυμία<input name="name" defaultValue="My First ERP Company" required /></label>
              <label>ΑΦΜ<input name="vatNumber" defaultValue="099999999" /></label>
              <label>ΔΟΥ<input name="taxOffice" defaultValue="DOY ATHINON" /></label>
              <label>Διεύθυνση<input name="address" defaultValue="Sarantaporou 7" /></label>
              <label>Πόλη<input name="city" defaultValue="Korydallos" /></label>
              <label>Τ.Κ.<input name="postalCode" defaultValue="18100" /></label>
              <label>Χώρα<input name="country" defaultValue="GR" required /></label>
              <button disabled={busy}>Αποθήκευση</button>
            </form>
          </Panel>

          <Panel title="Πελάτης" icon={<Users size={19} />} id="customers">
            <form className="form-grid" onSubmit={(event) => runAction(() => createCustomer(event), "Ο πελάτης αποθηκεύτηκε")}>
              <label>ΑΦΜ<input value={customerVat} onChange={(event) => setCustomerVat(event.target.value)} /></label>
              <button type="button" className="secondary" disabled={busy || !customerVat} onClick={() => runAction(lookupVat, "Ο έλεγχος ΑΦΜ ολοκληρώθηκε")}>
                <Search size={17} />Έλεγχος
              </button>
              <label className="wide">Επωνυμία<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required /></label>
              {vatLookup ? (
                <div className={`lookup ${vatLookup.valid ? "valid" : "invalid"}`}>
                  {vatLookup.source}: {vatLookup.valid ? "valid VAT" : "not valid for VIES"}{vatLookup.address ? ` · ${vatLookup.address}` : ""}
                </div>
              ) : null}
              <button className="wide" disabled={busy || !selectedOrganizationId}>Αποθήκευση πελάτη</button>
            </form>
          </Panel>

          <Panel title="Προμηθευτής" icon={<Truck size={19} />} id="suppliers">
            <form className="form-grid" onSubmit={(event) => runAction(() => createSupplier(event), "Ο προμηθευτής αποθηκεύτηκε")}>
              <label>ΑΦΜ<input value={supplierVat} onChange={(event) => setSupplierVat(event.target.value)} /></label>
              <button type="button" className="secondary" disabled={busy || !supplierVat} onClick={() => runAction(lookupSupplierVat, "Ο έλεγχος ΑΦΜ προμηθευτή ολοκληρώθηκε")}>
                <Search size={17} />Έλεγχος
              </button>
              <label className="wide">Επωνυμία<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} required /></label>
              {supplierVatLookup ? (
                <div className={`lookup ${supplierVatLookup.valid ? "valid" : "invalid"}`}>
                  {supplierVatLookup.source}: {supplierVatLookup.valid ? "valid VAT" : "not valid for VIES"}{supplierVatLookup.address ? ` · ${supplierVatLookup.address}` : ""}
                </div>
              ) : null}
              <button className="wide" disabled={busy || !selectedOrganizationId || !authenticated}>Αποθήκευση προμηθευτή</button>
            </form>
          </Panel>

          <Panel title="Καταχώριση Αγοράς / Εξόδου" icon={<ShoppingCart size={19} />} id="purchases-form">
            <form className="form-grid" onSubmit={(event) => runAction(() => createPurchase(event), "Η αγορά καταχωρήθηκε και ενημερώθηκε το απόθεμα")}>
              <label>Προμηθευτής<select name="supplierId" value={selectedSupplierId} onChange={(event) => setSelectedSupplierId(event.target.value)} required><option value="" disabled>Επιλογή προμηθευτή</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{s.vatNumber ? ` (${s.vatNumber})` : ""}</option>)}</select></label>
              <label>Παραλαβή σε αποθήκη<select name="warehouseId" value={movementWarehouseId} onChange={(event) => setMovementWarehouseId(event.target.value)}><option value="">Κεντρική αποθήκη</option>{warehouses.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}</select></label>
              <label>Αρ. Παραστατικού<input name="documentNumber" placeholder="π.χ. ΤΠ-10492" required /></label>
              <label>Είδος αποθήκης<select value={purchaseProductId} onChange={(event) => { setPurchaseProductId(event.target.value); const found = products.find(p => p.id === event.target.value); if (found) { setPurchaseDescription(found.name); setPurchaseUnitPrice(Number(found.unitPrice)); setPurchaseVatRate(Number(found.vatRate)); } }}><option value="">Γενικό έξοδο / Χωρίς είδος</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ""}{p.name}</option>)}</select></label>
              <label className="wide">Περιγραφή<input value={purchaseDescription} onChange={(event) => setPurchaseDescription(event.target.value)} placeholder="π.χ. Αγορά εξοπλισμού / εμπορεύματος" required /></label>
              <label>Ποσότητα<input type="number" step="0.01" min="0.0001" value={purchaseQuantity} onChange={(event) => setPurchaseQuantity(Number(event.target.value))} required /></label>
              <label>Τιμή Μονάδας (€)<input type="number" step="0.01" min="0" value={purchaseUnitPrice} onChange={(event) => setPurchaseUnitPrice(Number(event.target.value))} required /></label>
              <label>ΦΠΑ %<input type="number" step="0.01" min="0" value={purchaseVatRate} onChange={(event) => setPurchaseVatRate(Number(event.target.value))} required /></label>
              <label>Ημερομηνία<input name="issueDate" type="date" defaultValue={new Date().toISOString().split("T")[0]} required /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId || !authenticated || !suppliers.length}>Καταχώριση Αγοράς (+ Παραλαβή)</button>
            </form>
          </Panel>

          <Panel title="Κατάλογος ειδών" icon={<Package size={19} />} id="products">
            <form className="form-grid" onSubmit={(event) => runAction(() => createFamily(event), "Η οικογένεια αποθηκεύτηκε")}><label className="wide">Νέα οικογένεια<input name="name" placeholder="π.χ. Υπηρεσίες ιστοσελίδας" required /></label><button disabled={busy || !selectedOrganizationId || !authenticated}>Προσθήκη οικογένειας</button></form>
            <form className="form-grid" onSubmit={(event) => runAction(() => createCategory(event), "Η κατηγορία αποθηκεύτηκε")}><label>Οικογένεια<select name="familyId" required defaultValue="">{<option value="" disabled>Επιλογή οικογένειας</option>}{catalog.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}</select></label><label>Νέα κατηγορία<input name="name" placeholder="π.χ. Κατασκευή" required /></label><button disabled={busy || !selectedOrganizationId || !authenticated}>Προσθήκη κατηγορίας</button></form>
            {catalog.map((family) => <div className="lookup valid" key={family.id}><strong>{family.name}</strong>{family.categories.map((category) => <div key={category.id}><p>{category.name}</p>{category.products.map((product) => <div key={product.id}><span>{product.name} · {money(product.unitPrice)}</span>{product.trackSerialNumbers ? <form className="form-grid" onSubmit={(event) => runAction(() => addSerial(event), "Ο σειριακός αριθμός αποθηκεύτηκε")}><input type="hidden" name="productId" value={product.id} /><label>Serial<input name="serialNumber" required /></label><label>Σημείωση<input name="notes" /></label><button disabled={busy || !authenticated}>Προσθήκη serial</button>{product.serials.map((serial) => <small key={serial.id}>{serial.serialNumber} · {serial.status}</small>)}</form> : null}</div>)}</div>)}</div>)}
          </Panel>
          <Panel title="Προϊόν ή υπηρεσία" icon={<Package size={19} />} id="products">
            <form className="form-grid" onSubmit={(event) => runAction(() => createProduct(event), "Το προϊόν αποθηκεύτηκε")}>
              <label>Κωδικός<input name="code" defaultValue={`ITEM-${String(products.length + 1).padStart(3, "0")}`} /></label>
              <label>Ονομασία<input name="name" defaultValue="Νέο είδος" required /></label>
              <label>Κατηγορία<select name="categoryId" value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}><option value="">Χωρίς κατηγορία</option>{catalog.flatMap((family) => family.categories.map((category) => <option key={category.id} value={category.id}>{family.name} · {category.name}</option>))}</select></label>
              <label>Τιμή μονάδας<input name="unitPrice" type="number" min="0" step="0.01" defaultValue="100" required /></label>
              <label>ΦΠΑ %<input name="vatRate" type="number" min="0" step="0.01" defaultValue="24" required /></label>
              <label><input name="trackSerialNumbers" type="checkbox" /> Παρακολούθηση σειριακών αριθμών</label>
              <button className="wide" disabled={busy || !selectedOrganizationId || !authenticated}>Αποθήκευση προϊόντος</button>
            </form>
          </Panel>

          <Panel title="Σειρά παραστατικών" icon={<ReceiptText size={19} />}>
            <form className="form-grid" onSubmit={(event) => runAction(() => createSeries(event), "Η σειρά αποθηκεύτηκε")}>
              <label>Κωδικός<input name="code" defaultValue={series.length ? `A${series.length + 1}` : "TP"} required /></label>
              <label>Document type<input name="documentType" defaultValue="1.1" required /></label>
              <label>Wrapp billing book ID<input name="providerBillingBookId" placeholder="UUID from Wrapp" /></label>
              <label>Επόμενος αριθμός<input name="nextNumber" type="number" min="1" defaultValue="1" required /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId}>Αποθήκευση σειράς</button>
            </form>
          </Panel>

          <Panel title="Αποθήκες" icon={<Boxes size={19} />} id="warehouses">
            <form className="form-grid" onSubmit={(event) => runAction(() => createWarehouse(event), "Η αποθήκη δημιουργήθηκε")}>
              <label>Κωδικός<input name="code" maxLength={20} placeholder="π.χ. SHOP" required /></label>
              <label>Ονομασία<input name="name" placeholder="π.χ. Αποθήκη καταστήματος" required /></label>
              <label className="wide">Διεύθυνση <small>(προαιρετικό)</small><input name="address" placeholder="π.χ. Κεντρικό κατάστημα" /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId || !authenticated}>Προσθήκη αποθήκης</button>
            </form>
            <div className="chip-row">{warehouses.map((item) => <span className="chip" key={item.id}>[{item.code}] {item.name}</span>)}</div>
          </Panel>

          <Panel title="Κίνηση Αποθήκης" icon={<PackagePlus size={19} />} id="inventory-form">
            <form className="form-grid" onSubmit={(event) => runAction(() => createStockMovement(event), "Η κίνηση αποθήκης καταχωρήθηκε")}>
              <label>Αποθήκη<select name="warehouseId" value={movementWarehouseId} onChange={(event) => setMovementWarehouseId(event.target.value)} required><option value="" disabled>Επιλογή αποθήκης</option>{warehouses.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}</select></label>
              <label>Είδος<select name="productId" value={movementProductId} onChange={(event) => setMovementProductId(event.target.value)} required><option value="" disabled>Επιλογή είδους</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ""}{p.name}</option>)}</select></label>
              <label>Τύπος κίνησης<select name="type" value={movementType} onChange={(event) => setMovementType(event.target.value as any)}><option value="RECEIPT">📦 Παραλαβή / Αγορά (+)</option><option value="INITIAL">📥 Αρχικό Απόθεμα (+)</option><option value="ADJUSTMENT">⚖️ Διόρθωση Απογραφής (+/-)</option><option value="SALE">📤 Χειροκίνητη Έξοδος (-)</option><option value="RETURN">🔄 Επιστροφή (+)</option></select></label>
              <label>Ποσότητα<input name="quantity" type="number" step="0.01" defaultValue="1" required /></label>
              <label>Κόστος μονάδας (€)<input name="unitCost" type="number" step="0.01" min="0" placeholder="Προαιρετικό" /></label>
              <label className="wide">Serial numbers <small>(ένας ανά γραμμή ή με κόμμα, μόνο για είδη με serial)</small><textarea name="serialNumbers" rows={3} placeholder="π.χ. SN-001&#10;SN-002" /></label>
              <label className="wide">Σχετικό Παραστατικό / Reference<input name="reference" placeholder="π.χ. ΤΙΜ-ΑΓΟΡΑΣ-0142 ή Απογραφή 2026" /></label>
              <label className="wide">Σημειώσεις / Αιτιολογία<input name="notes" placeholder="π.χ. Επανέλεγχος ραφιού" /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId || !authenticated || !products.length || !warehouses.length}>Καταχώριση κίνησης</button>
            </form>
          </Panel>

          <Panel title="Μεταφορά μεταξύ αποθηκών" icon={<ArrowRight size={19} />} id="stock-transfer">
            <form className="form-grid" onSubmit={(event) => runAction(() => transferStock(event), "Η μεταφορά αποθέματος ολοκληρώθηκε")}>
              <label>Είδος<select name="productId" defaultValue={movementProductId} required><option value="" disabled>Επιλογή είδους</option>{products.map((item) => <option key={item.id} value={item.id}>{item.code ? `[${item.code}] ` : ""}{item.name}</option>)}</select></label>
              <label>Από αποθήκη<select name="fromWarehouseId" defaultValue={movementWarehouseId} required><option value="" disabled>Επιλογή αποθήκης</option>{warehouses.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}</select></label>
              <label>Προς αποθήκη<select name="toWarehouseId" required><option value="" disabled>Επιλογή αποθήκης</option>{warehouses.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>)}</select></label>
              <label>Ποσότητα<input name="quantity" type="number" min="1" step="1" defaultValue="1" required /></label>
              <label className="wide">Serial numbers <small>(υποχρεωτικά για serialised είδη)</small><textarea name="serialNumbers" rows={3} placeholder="Ένας αριθμός ανά γραμμή ή με κόμμα" /></label>
              <label>Αναφορά<input name="reference" placeholder="π.χ. ΜΕΤ-0001" /></label>
              <label>Σημειώσεις<input name="notes" placeholder="Προαιρετικό" /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId || !authenticated || warehouses.length < 2}>Μεταφορά αποθέματος</button>
            </form>
          </Panel>

          <Panel title="Είσπραξη / Πληρωμή" icon={<BadgePercent size={19} />} id="payment-form">
            <form className="form-grid" onSubmit={(event) => runAction(() => createPayment(event), "Η πληρωμή/είσπραξη καταχωρήθηκε")}>
              <label>Τύπος<select value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)}><option value="CUSTOMER_RECEIPT">📥 Είσπραξη από Πελάτη</option><option value="SUPPLIER_PAYMENT">📤 Πληρωμή σε Προμηθευτή</option></select></label>
              {paymentType === "CUSTOMER_RECEIPT" ? (
                <>
                  <label>Πελάτης<select value={paymentTargetCustomerId} onChange={(e) => { setPaymentTargetCustomerId(e.target.value); setPaymentTargetInvoiceId(""); }}><option value="">Επιλογή πελάτη</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                  <label className="wide">Συσχετισμένο Τιμολόγιο (Προαιρετικό)<select value={paymentTargetInvoiceId} onChange={(e) => { setPaymentTargetInvoiceId(e.target.value); const found = invoices.find(inv => inv.id === e.target.value); if (found) setPaymentAmount(Number(found.totalAmount)); }}><option value="">Γενική είσπραξη έναντι λογαριασμού</option>{invoices.filter(inv => !paymentTargetCustomerId || inv.customer?.id === paymentTargetCustomerId).map((inv) => <option key={inv.id} value={inv.id}>{inv.series?.code}-{inv.invoiceNumber} ({money(inv.totalAmount)}) - {inv.paymentStatus || "UNPAID"}</option>)}</select></label>
                </>
              ) : (
                <>
                  <label>Προμηθευτής<select value={paymentTargetSupplierId} onChange={(e) => { setPaymentTargetSupplierId(e.target.value); setPaymentTargetPurchaseId(""); }}><option value="">Επιλογή προμηθευτή</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                  <label className="wide">Συσχετισμένη Αγορά (Προαιρετικό)<select value={paymentTargetPurchaseId} onChange={(e) => { setPaymentTargetPurchaseId(e.target.value); const found = purchases.find(p => p.id === e.target.value); if (found) setPaymentAmount(Number(found.totalAmount)); }}><option value="">Γενική πληρωμή έναντι υπολοίπου</option>{purchases.filter(p => !paymentTargetSupplierId || p.supplier?.id === paymentTargetSupplierId).map((p) => <option key={p.id} value={p.id}>{p.documentNumber} ({money(p.totalAmount)}) - {p.paymentStatus || "PAID"}</option>)}</select></label>
                </>
              )}
              <label>Ποσό (€)<input type="number" step="0.01" min="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} required /></label>
              <label>Τρόπος πληρωμής<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="BANK_TRANSFER">Τραπεζική Κατάθεση</option><option value="CARD">Κάρτα</option><option value="CASH">Μετρητά</option><option value="IRIS">IRIS</option><option value="OTHER">Άλλο</option></select></label>
              <label className="wide">Αριθμός Παραστατικού / Αναφορά<input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="π.χ. ΑΠΟΔ-102 ή Τραπεζικό έμβασμα" /></label>
              <label className="wide">Σημειώσεις<input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="π.χ. Εξόφληση 1ης δόσης" /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId}>Καταχώριση Συναλλαγής</button>
            </form>
          </Panel>

          <Panel title="Νέα Προσφορά (Quote)" icon={<FileSpreadsheet size={19} />} id="quote-form">
            <form className="form-grid" onSubmit={(event) => runAction(() => createQuote(event), "Η προσφορά δημιουργήθηκε")}>
              <label>Πελάτης<select value={quoteCustomerId} onChange={(e) => setQuoteCustomerId(e.target.value)}><option value="">Επιλογή πελάτη</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Είδος / Υπηρεσία<select value={quoteProductId} onChange={(e) => { setQuoteProductId(e.target.value); const found = products.find(p => p.id === e.target.value); if (found) { setQuoteDescription(found.name); setQuoteUnitPrice(Number(found.unitPrice)); setQuoteVatRate(Number(found.vatRate)); } }}><option value="">Ελεύθερη περιγραφή</option>{products.map((p) => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ""}{p.name}</option>)}</select></label>
              <label className="wide">Περιγραφή<input value={quoteDescription} onChange={(e) => setQuoteDescription(e.target.value)} placeholder="π.χ. Υπηρεσίες Web Design & Hosting 2026" required /></label>
              <label>Ποσότητα<input type="number" step="0.01" min="0.01" value={quoteQuantity} onChange={(e) => setQuoteQuantity(Number(e.target.value))} required /></label>
              <label>Τιμή Μονάδας (€)<input type="number" step="0.01" min="0" value={quoteUnitPrice} onChange={(e) => setQuoteUnitPrice(Number(e.target.value))} required /></label>
              <label>ΦΠΑ %<input type="number" step="0.01" min="0" value={quoteVatRate} onChange={(e) => setQuoteVatRate(Number(e.target.value))} required /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId}>Δημιουργία Προσφοράς</button>
            </form>
          </Panel>

          <Panel title="Πάροχος" icon={<PlugZap size={19} />}>
            <form className="form-grid" onSubmit={(event) => runAction(() => saveProviderCredential(event), "Ο πάροχος αποθηκεύτηκε")}>
              <label>Πάροχος<input name="provider" defaultValue="sandbox-yphahes" required /></label>
              <label>Περιβάλλον<select name="environment" defaultValue="SANDBOX"><option>SANDBOX</option><option>PRODUCTION</option></select></label>
              <label className="wide">API key<input name="apiKey" defaultValue="sandbox-placeholder" /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId}>Αποθήκευση παρόχου</button>
            </form>
          </Panel>
        </section>

        <section className="inventory-section" id="inventory">
          <div className="section-title">
            <div>
              <span className="eyebrow">Διαχείριση αποθεμάτων</span>
              <h2>Αποθήκη & Υπόλοιπα Προϊόντων</h2>
            </div>
            <div className="register-total">{stockBalances.length} είδη</div>
          </div>

          <div className="data-table-container">
            {stockBalances.length === 0 ? (
              <div className="empty">Δεν υπάρχουν καταχωρημένα προϊόντα στην επιχείρηση.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Κωδικός</th>
                    <th>Είδος</th>
                    <th>Κατηγορία</th>
                    <th>Τιμή (€)</th>
                    <th>Υπόλοιπο</th>
                    <th>Serials</th>
                    <th>Ενέργεια</th>
                  </tr>
                </thead>
                <tbody>
                  {stockBalances.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.code || "—"}</strong></td>
                      <td>
                        <strong>{item.name}</strong>
                        {item.description ? <div style={{ color: "var(--muted)", fontSize: 11 }}>{item.description}</div> : null}
                      </td>
                      <td>{item.category ? `${item.category.familyName} → ${item.category.name}` : "—"}</td>
                      <td>{money(item.unitPrice)}</td>
                      <td>
                        <span className={`stock-badge ${Number(item.currentStock) > 0 ? "positive" : Number(item.currentStock) < 0 ? "negative" : "zero"}`}>
                          {item.currentStock} {item.unit}
                        </span>
                      </td>
                      <td>
                        {item.trackSerialNumbers ? (
                          <small style={{ color: "var(--accent-dark)", fontWeight: 700 }}>
                            {item.availableSerialsCount} διαθέσιμα
                          </small>
                        ) : (
                          <span style={{ color: "var(--muted)", fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          style={{ minHeight: 32, padding: "0 8px", fontSize: 12 }}
                          onClick={() => {
                            setMovementProductId(item.id);
                            const el = document.getElementById("inventory-form");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          + Κίνηση
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="section-title" style={{ marginTop: 24 }}>
            <div>
              <span className="eyebrow">Audit trail</span>
              <h2>Ιστορικό Κινήσεων Αποθήκης</h2>
            </div>
            <div className="register-total">{stockMovements.length} κινήσεις</div>
          </div>

          <div className="data-table-container">
            {stockMovements.length === 0 ? (
              <div className="empty">Δεν υπάρχουν καταγεγραμμένες κινήσεις αποθήκης.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ημερομηνία</th>
                    <th>Είδος</th>
                    <th>Τύπος</th>
                    <th>Ποσότητα</th>
                    <th>Παραστατικό</th>
                    <th>Σημειώσεις</th>
                  </tr>
                </thead>
                <tbody>
                  {stockMovements.map((mov) => {
                    const typeLabels: Record<string, { label: string; cls: string }> = {
                      INITIAL: { label: "📥 Αρχικό Απόθεμα", cls: "initial" },
                      RECEIPT: { label: "📦 Παραλαβή", cls: "receipt" },
                      ADJUSTMENT: { label: "⚖️ Διόρθωση", cls: "adjustment" },
                      SALE: { label: "📤 Πώληση / Έξοδος", cls: "sale" },
                      RETURN: { label: "🔄 Επιστροφή", cls: "return" }
                    };
                    const badge = typeLabels[mov.type] || { label: mov.type, cls: "initial" };
                    const qty = Number(mov.quantity);

                    return (
                      <tr key={mov.id}>
                        <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                          {new Date(mov.createdAt).toLocaleString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td>
                          <strong>{mov.product.name}</strong>
                          {mov.product.code ? <small style={{ color: "var(--muted)", marginLeft: 6 }}>[{mov.product.code}]</small> : null}
                        </td>
                        <td>
                          <span className={`movement-type-badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td>
                          <strong style={{ color: qty > 0 ? "#1f6b45" : qty < 0 ? "var(--danger)" : "inherit" }}>
                            {qty > 0 ? `+${qty}` : qty} {mov.product.unit}
                          </strong>
                        </td>
                        <td>{mov.reference || "—"}</td>
                        <td>{mov.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="inventory-section" id="purchases">
          <div className="section-title">
            <div>
              <span className="eyebrow">Έξοδα & Αγορές</span>
              <h2>Μητρώο Αγορών & Εξόδων</h2>
            </div>
            <div className="register-total">{purchases.length} records</div>
          </div>

          <div className="data-table-container">
            {purchases.length === 0 ? (
              <div className="empty">Δεν υπάρχουν καταχωρημένες αγορές.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ημερομηνία</th>
                    <th>Αρ. Παραστατικού</th>
                    <th>Προμηθευτής</th>
                    <th>Καθαρή Αξία</th>
                    <th>ΦΠΑ</th>
                    <th>Σύνολο</th>
                    <th>Γραμμές</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                        {new Date(purchase.issueDate).toLocaleDateString("el-GR")}
                      </td>
                      <td><strong>{purchase.documentNumber}</strong></td>
                      <td>
                        <strong>{purchase.supplier.name}</strong>
                        {purchase.supplier.vatNumber ? <div style={{ color: "var(--muted)", fontSize: 11 }}>ΑΦΜ: {purchase.supplier.vatNumber}</div> : null}
                      </td>
                      <td>{money(purchase.netAmount)}</td>
                      <td>{money(purchase.vatAmount)}</td>
                      <td><strong>{money(purchase.totalAmount)}</strong></td>
                      <td>
                        {purchase.lines.map((l) => (
                          <div key={l.id} style={{ fontSize: 11, color: "var(--ink)" }}>
                            {Number(l.quantity)}x {l.description} ({money(l.totalValue)})
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="inventory-section" id="ledgers">
          <div className="section-title">
            <div>
              <span className="eyebrow">Οικονομική Παρακολούθηση</span>
              <h2>Καρτέλες Πελατών & Εισπράξεις / Πληρωμές</h2>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700 }}>Πελάτης:</span>
              <select
                value={selectedLedgerCustomerId}
                onChange={(e) => {
                  setSelectedLedgerCustomerId(e.target.value);
                  loadCustomerLedger(e.target.value);
                }}
                style={{ minWidth: 200 }}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {customerLedger ? (
            <>
              <div className="metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <div className="metric">
                  <div><TrendingUp size={22} color="#0f766e" /></div>
                  <span>Σύνολο Τιμολογήσεων</span>
                  <strong>{money(customerLedger.totalBilled)}</strong>
                  <small style={{ color: "var(--muted)", fontSize: 11 }}>Χρεώσεις πελάτη</small>
                </div>
                <div className="metric">
                  <div><CheckCircle2 size={22} color="#1f6b45" /></div>
                  <span>Σύνολο Εισπράξεων</span>
                  <strong>{money(customerLedger.totalPaid)}</strong>
                  <small style={{ color: "var(--muted)", fontSize: 11 }}>Πιστώσεις / Πληρωμές</small>
                </div>
                <div className="metric" style={{ borderColor: customerLedger.currentBalance > 0 ? "var(--danger)" : "#1f6b45" }}>
                  <div><Scale size={22} color={customerLedger.currentBalance > 0 ? "var(--danger)" : "#1f6b45"} /></div>
                  <span>Ανεξόφλητο Υπόλοιπο</span>
                  <strong style={{ color: customerLedger.currentBalance > 0 ? "var(--danger)" : "#1f6b45" }}>
                    {money(customerLedger.currentBalance)}
                  </strong>
                  <small style={{ color: "var(--muted)", fontSize: 11 }}>
                    {customerLedger.currentBalance > 0 ? "Οφειλή προς την επιχείρηση" : "Εξοφλημένος / Πιστωτικός"}
                  </small>
                </div>
              </div>

              <div className="data-table-container" style={{ marginTop: 14 }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", background: "#f8faf9", fontWeight: 800, fontSize: 13 }}>
                  Αναλυτική Καρτέλα: {customerLedger.customer.name}
                </div>
                {customerLedger.entries.length === 0 ? (
                  <div className="empty">Δεν υπάρχουν καταχωρημένες κινήσεις για αυτόν τον πελάτη.</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ημερομηνία</th>
                        <th>Τύπος</th>
                        <th>Παραστατικό / Αναφορά</th>
                        <th>Περιγραφή</th>
                        <th style={{ textAlign: "right" }}>Χρέωση (+)</th>
                        <th style={{ textAlign: "right" }}>Πίστωση (-)</th>
                        <th style={{ textAlign: "right" }}>Υπόλοιπο</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerLedger.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                            {new Date(entry.date).toLocaleDateString("el-GR")}
                          </td>
                          <td>
                            <span className={`pill ${entry.type === "INVOICE" ? "issued" : entry.type === "RECEIPT" ? "submitting" : "credited"}`} style={{ fontSize: 11 }}>
                              {entry.type === "INVOICE" ? "Τιμολόγιο" : entry.type === "RECEIPT" ? "Είσπραξη" : "Πιστωτικό"}
                            </span>
                          </td>
                          <td><strong>{entry.reference}</strong></td>
                          <td>{entry.description}</td>
                          <td style={{ textAlign: "right", color: entry.debit > 0 ? "var(--ink)" : "var(--muted)" }}>
                            {entry.debit > 0 ? money(entry.debit) : "—"}
                          </td>
                          <td style={{ textAlign: "right", color: entry.credit > 0 ? "#1f6b45" : "var(--muted)", fontWeight: entry.credit > 0 ? 700 : 400 }}>
                            {entry.credit > 0 ? money(entry.credit) : "—"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <strong style={{ color: entry.balance > 0 ? "var(--danger)" : "#1f6b45" }}>
                              {money(entry.balance)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="empty">Επιλέξτε πελάτη για εμφάνιση της καρτέλας.</div>
          )}

          <div className="section-title" style={{ marginTop: 28 }}>
            <div>
              <span className="eyebrow">Ιστορικό Συναλλαγών</span>
              <h2>Πρόσφατες Εισπράξεις & Πληρωμές</h2>
            </div>
            <div className="register-total">{payments.length} συναλλαγές</div>
          </div>

          <div className="data-table-container">
            {payments.length === 0 ? (
              <div className="empty">Δεν έχουν καταχωρηθεί εισπράξεις ή πληρωμές.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ημερομηνία</th>
                    <th>Τύπος</th>
                    <th>Συναλλασσόμενος</th>
                    <th>Ποσό</th>
                    <th>Τρόπος</th>
                    <th>Αναφορά</th>
                    <th>Σημειώσεις</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                        {new Date(p.paymentDate).toLocaleDateString("el-GR")}
                      </td>
                      <td>
                        <span className={`pill ${p.type === "CUSTOMER_RECEIPT" ? "issued" : "submitting"}`} style={{ fontSize: 11 }}>
                          {p.type === "CUSTOMER_RECEIPT" ? "📥 Είσπραξη" : "📤 Πληρωμή"}
                        </span>
                      </td>
                      <td><strong>{p.customer?.name || p.supplier?.name || "—"}</strong></td>
                      <td>
                        <strong style={{ color: p.type === "CUSTOMER_RECEIPT" ? "#1f6b45" : "var(--danger)" }}>
                          {money(p.amount)}
                        </strong>
                      </td>
                      <td>{p.paymentMethod}</td>
                      <td>{p.reference || "—"}</td>
                      <td>{p.notes || (p.invoice ? `Τιμ: ${p.invoice.series?.code}-${p.invoice.invoiceNumber}` : "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="inventory-section" id="quotes-orders">
          <div className="section-title">
            <div>
              <span className="eyebrow">Order-to-Cash</span>
              <h2>Μητρώο Προσφορών (Quotes / Proforma)</h2>
            </div>
            <div className="register-total">{quotes.length} προσφορές</div>
          </div>

          <div className="data-table-container">
            {quotes.length === 0 ? (
              <div className="empty">Δεν υπάρχουν καταχωρημένες προσφορές.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ημερομηνία</th>
                    <th>Αρ. Προσφοράς</th>
                    <th>Πελάτης</th>
                    <th>Καθαρή Αξία</th>
                    <th>ΦΠΑ</th>
                    <th>Σύνολο</th>
                    <th>Κατάσταση</th>
                    <th>Ενέργειες 1-Click</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                        {new Date(quote.issueDate).toLocaleDateString("el-GR")}
                      </td>
                      <td><strong>{quote.quoteNumber}</strong></td>
                      <td><strong>{quote.customer?.name || "Ιδιώτης / Λιανική"}</strong></td>
                      <td>{money(quote.netAmount)}</td>
                      <td>{money(quote.vatAmount)}</td>
                      <td><strong>{money(quote.totalAmount)}</strong></td>
                      <td>
                        <span className={`pill ${quote.status === "CONVERTED" ? "issued" : quote.status === "ACCEPTED" ? "submitting" : "draft"}`} style={{ fontSize: 11 }}>
                          {quote.status === "CONVERTED" ? "Τιμολογήθηκε" : quote.status === "ACCEPTED" ? "Αποδεκτή" : quote.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {quote.status !== "CONVERTED" ? (
                            <>
                              <button
                                type="button"
                                className="secondary"
                                style={{ minHeight: 30, padding: "0 8px", fontSize: 11 }}
                                disabled={busy}
                                onClick={() => runAction(() => convertQuoteToInvoice(quote.id), "Η προσφορά μετατράπηκε σε τιμολόγιο")}
                              >
                                <Zap size={13} color="#bd8427" /> Τιμολόγιο
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                style={{ minHeight: 30, padding: "0 8px", fontSize: 11 }}
                                disabled={busy}
                                onClick={() => runAction(() => convertQuoteToOrder(quote.id), "Η προσφορά μετατράπηκε σε παραγγελία")}
                              >
                                <ShoppingCart size={13} /> Σε Παραγγελία
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: 12, color: "#1f6b45", fontWeight: 700 }}>✓ Ολοκληρώθηκε</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="section-title" style={{ marginTop: 28 }}>
            <div>
              <span className="eyebrow">Sales Pipeline</span>
              <h2>Μητρώο Παραγγελιών Πώλησης (Sales Orders)</h2>
            </div>
            <div className="register-total">{orders.length} παραγγελίες</div>
          </div>

          <div className="data-table-container">
            {orders.length === 0 ? (
              <div className="empty">Δεν υπάρχουν καταχωρημένες παραγγελίες.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ημερομηνία</th>
                    <th>Αρ. Παραγγελίας</th>
                    <th>Πελάτης</th>
                    <th>Σύνολο</th>
                    <th>Κατάσταση</th>
                    <th>Ενέργειες 1-Click</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                        {new Date(order.orderDate).toLocaleDateString("el-GR")}
                      </td>
                      <td><strong>{order.orderNumber}</strong></td>
                      <td><strong>{order.customer?.name || "Ιδιώτης / Λιανική"}</strong></td>
                      <td><strong>{money(order.totalAmount)}</strong></td>
                      <td>
                        <span className={`pill ${order.status === "INVOICED" ? "issued" : "submitting"}`} style={{ fontSize: 11 }}>
                          {order.status === "INVOICED" ? "Τιμολογήθηκε" : order.status}
                        </span>
                      </td>
                      <td>
                        {order.status !== "INVOICED" ? (
                          <button
                            type="button"
                            className="secondary"
                            style={{ minHeight: 30, padding: "0 8px", fontSize: 11 }}
                            disabled={busy}
                            onClick={() => runAction(() => convertOrderToInvoice(order.id), "Η παραγγελία μετατράπηκε σε τιμολόγιο")}
                          >
                            <Zap size={13} color="#bd8427" /> Έκδοση Τιμολογίου
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "#1f6b45", fontWeight: 700 }}>✓ Τιμολογήθηκε</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="invoice-section" id="invoices">
          <div className="section-title">
            <div>
              <span className="eyebrow">Μητρώο παραστατικών</span>
              <h2>Παραστατικά</h2>
            </div>
            <div className="register-total">{invoices.length} records</div>
          </div>
          <div className="invoice-list">
            {invoices.length === 0 ? <div className="empty">Δεν υπάρχουν παραστατικά.</div> : invoices.map((invoice) => (
              <article className="invoice-card" key={invoice.id}>
                <div>
                  <strong>{invoice.series.code}{invoice.invoiceNumber ? `-${invoice.invoiceNumber}` : " draft"}</strong>
                  <span>{invoice.customer?.name || "No customer"} / {invoice.documentType === "5.1" ? "Πιστωτικό Τιμολόγιο" : invoice.documentType}</span>
                  {invoice.creditedInvoice ? (
                    <small style={{ display: "block", color: "#9d174d", fontSize: 11, marginTop: 2 }}>
                      Συσχετισμένο με: {invoice.creditedInvoice.series?.code}-{invoice.creditedInvoice.invoiceNumber}
                    </small>
                  ) : null}
                </div>
                <div className="amounts">
                  <span>Net {money(invoice.netAmount)}</span>
                  <span>VAT {money(invoice.vatAmount)}</span>
                  <strong>{money(invoice.totalAmount)}</strong>
                </div>
                <div className="invoice-actions">
                  <span className={`pill ${invoice.status.toLowerCase()}`}>{invoice.status}</span>
                  {invoice.status === "DRAFT" || invoice.status === "READY" ? (
                    <>
                      <button className="secondary" disabled={busy} onClick={() => runAction(() => checkReadiness(invoice.id), "Readiness checked")}>
                        <CheckCircle2 size={17} />Έλεγχος
                      </button>
                      <button disabled={busy} onClick={() => runAction(() => queueProviderIssue(invoice.id), "Provider transmission queued")}>
                        <PlugZap size={17} />Πάροχος
                      </button>
                      <button disabled={busy || !authenticated} onClick={() => runAction(() => issueWrappStaging(invoice.id), "Το παραστατικό εκδόθηκε μέσω Wrapp staging")}>
                        <Send size={17} />Wrapp staging
                      </button>
                      <button className="secondary" disabled={busy} onClick={() => runAction(() => issueInvoice(invoice.id), "Το παραστατικό εκδόθηκε τοπικά")}>
                        Local
                      </button>
                    </>
                  ) : invoice.status === "ISSUED" ? (
                    <>
                      <span className="provider">{invoice.mydataMark ? `MARK ${invoice.mydataMark}` : (invoice.providerStatus || "Provider pending")}</span>
                      <button className="danger" style={{ minHeight: 32, padding: "0 8px", fontSize: 12 }} disabled={busy} onClick={() => runAction(() => cancelInvoice(invoice.id), "Το παραστατικό ακυρώθηκε και το απόθεμα επαναφέρθηκε")}>
                        <Ban size={14} />Ακύρωση
                      </button>
                      <button className="warning" style={{ minHeight: 32, padding: "0 8px", fontSize: 12 }} disabled={busy} onClick={() => runAction(() => issueCreditNote(invoice.id), "Εκδόθηκε πιστωτικό τιμολόγιο και το απόθεμα επαναφέρθηκε")}>
                        <CreditCard size={14} />Πιστωτικό
                      </button>
                    </>
                  ) : (
                    <span className="provider" style={{ color: invoice.status === "CANCELLED" ? "var(--danger)" : "#9d174d", fontSize: 12 }}>
                      {invoice.cancelReason || invoice.status}
                    </span>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    style={{ minHeight: 32, padding: "0 8px", fontSize: 12 }}
                    onClick={() => window.open(`/erp-api/invoices/${invoice.id}/print?autoprint=1`, "_blank")}
                  >
                    <Printer size={14} />Εκτύπωση/PDF
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <div className="metric"><div>{icon}</div><span>{label}</span><strong>{value}</strong></div>;
}

function Panel({ children, icon, id, title }: { children: React.ReactNode; icon: React.ReactNode; id?: string; title: string }) {
  return <section className="panel" id={id}><h2>{icon}{title}</h2>{children}</section>;
}
