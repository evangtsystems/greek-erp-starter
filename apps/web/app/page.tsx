"use client";

import {
  Building2,
  ΈλεγχοςCircle2,
  Clock3,
  FilePlus2,
  FileText,
  Landmark,
  Package,
  PlugZap,
  ReceiptText,
  ΑνανέωσηCw,
  Search,
  Send,
  ShieldΈλεγχος,
  TrendingUp,
  Users
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Επιχείρηση = { id: string; name: string; country: string };
type Customer = { id: string; name: string; vatNumber: string | null };
type Product = { id: string; code: string | null; name: string; unitPrice: string; vatRate: string };
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
  mydataMark?: string | null;
  mydataUid?: string | null;
  qrUrl?: string | null;
  customer: Customer | null;
  series: InvoiceSeries;
};
type ΠάροχοςCredential = {
  id: string;
  provider: string;
  environment: string;
  enabled: boolean;
};
type InvoiceTemplate = { id: string; title: string; description: string; price: number; vatRate: number; classificationType: string; classificationCategory: string };

const invoiceTemplates: InvoiceTemplate[] = [
  { id: "service", title: "Παροχή υπηρεσίας", description: "Υπηρεσία", price: 100, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "product", title: "Πώληση προϊόντος", description: "Εμπόρευμα", price: 50, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "technical", title: "Τεχνική εργασία", description: "Τεχνική εργασία", price: 80, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" },
  { id: "consulting", title: "Συμβουλευτική", description: "Υπηρεσίες συμβουλευτικής", price: 120, vatRate: 24, classificationType: "E3_561_001", classificationCategory: "category1_1" }
];

type VatΈλεγχος = {
  source: string;
  valid: boolean;
  name: string | null;
  address: string | null;
  countryΚωδικός: string;
  vatNumber: string;
};

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/erp-api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
};

const money = (value: string | number) =>
  new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" }).format(Number(value));

export default function Home() {
  const [organizations, setΕπιχείρησηs] = useState<Επιχείρηση[]>([]);
  const [selectedΕπιχείρησηId, setSelectedΕπιχείρησηId] = useState("");
  const [customers, setΠελάτες] = useState<Customer[]>([]);
  const [products, setΠροϊόντα] = useState<Product[]>([]);
  const [series, setSeries] = useState<InvoiceSeries[]>([]);
  const [invoices, setΠαραστατικά] = useState<Invoice[]>([]);
  const [providerCredentials, setΠάροχοςCredentials] = useState<ΠάροχοςCredential[]>([]);
  const [message, setMessage] = useState("Έτοιμο");
  const [busy, setBusy] = useState(false);
  const [vatΈλεγχος, setVatΈλεγχος] = useState<VatΈλεγχος | null>(null);
  const [customerΕπωνυμία, setCustomerΕπωνυμία] = useState("Acme Greek Customer");
  const [customerVat, setCustomerVat] = useState("099999999");
  const [wrappAdminKey, setWrappAdminKey] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("service");
  const [templatePrice, setTemplatePrice] = useState(100);

  const selectedΕπιχείρηση = useMemo(
    () => organizations.find((org) => org.id === selectedΕπιχείρησηId),
    [organizations, selectedΕπιχείρησηId]
  );
  const εκδομέναΠαραστατικά = invoices.filter((invoice) => invoice.status === "ISSUED");
  const πρόχειροΠαραστατικά = invoices.filter((invoice) => invoice.status === "DRAFT" || invoice.status === "READY");
  const totalIssued = εκδομέναΠαραστατικά.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);

  const loadΕπιχείρησηs = async () => {
    const data = await api<Επιχείρηση[]>("/organizations");
    setΕπιχείρησηs(data);
    setSelectedΕπιχείρησηId((current) => current || data[0]?.id || "");
  };

  const loadTenantData = async (organizationId: string) => {
    if (!organizationId) return;
    const [customerData, productData, seriesData, invoiceData, providerData] = await Promise.all([
      api<Customer[]>(`/customers?organizationId=${organizationId}`),
      api<Product[]>(`/products?organizationId=${organizationId}`),
      api<InvoiceSeries[]>(`/invoice-series?organizationId=${organizationId}`),
      api<Invoice[]>(`/invoices?organizationId=${organizationId}`),
      api<ΠάροχοςCredential[]>(`/provider-credentials?organizationId=${organizationId}`)
    ]);
    setΠελάτες(customerData);
    setΠροϊόντα(productData);
    setSeries(seriesData);
    setΠαραστατικά(invoiceData);
    setΠάροχοςCredentials(providerData);
  };

  useEffect(() => {
    loadΕπιχείρησηs().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadTenantData(selectedΕπιχείρησηId).catch((error) => setMessage(error.message));
  }, [selectedΕπιχείρησηId]);

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

  const createΕπιχείρηση = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const organization = await api<Επιχείρηση>("/organizations", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        vatNumber: form.get("vatNumber") || null,
        taxOffice: form.get("taxOffice") || null,
        address: form.get("address") || null,
        city: form.get("city") || null,
        postalΚωδικός: form.get("postalΚωδικός") || null,
        country: form.get("country")
      })
    });
    event.currentTarget.reset();
    await loadΕπιχείρησηs();
    setSelectedΕπιχείρησηId(organization.id);
  };

  const lookupVat = async () => {
    const result = await api<VatΈλεγχος>("/vat/lookup", {
      method: "POST",
      body: JSON.stringify({ countryΚωδικός: "EL", vatNumber: customerVat })
    });
    setVatΈλεγχος(result);
    if (result.name) setCustomerΕπωνυμία(result.name);
  };

  const createCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await api<Customer>("/customers", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedΕπιχείρησηId,
        type: "BUSINESS",
        name: customerΕπωνυμία,
        vatNumber: customerVat || null,
        country: "GR"
      })
    });
    await loadTenantData(selectedΕπιχείρησηId);
  };

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<Product>("/products", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedΕπιχείρησηId,
        code: form.get("code") || null,
        name: form.get("name"),
        unit: "hour",
        unitPrice: Number(form.get("unitPrice")),
        vatRate: Number(form.get("vatRate"))
      })
    });
    await loadTenantData(selectedΕπιχείρησηId);
  };

  const createSeries = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<InvoiceSeries>("/invoice-series", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedΕπιχείρησηId,
        code: form.get("code"),
        documentType: form.get("documentType"),
        nextNumber: Number(form.get("nextNumber")),
        providerBillingBookId: form.get("providerBillingBookId") || null
      })
    });
    await loadTenantData(selectedΕπιχείρησηId);
  };

  const saveΠάροχοςCredential = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<ΠάροχοςCredential>("/provider-credentials", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedΕπιχείρησηId,
        provider: form.get("provider"),
        environment: form.get("environment"),
        enabled: true,
        credentials: {
          apiKey: form.get("apiKey") || "sandbox-placeholder"
        },
        metadata: {
          displayΕπωνυμία: form.get("provider")
        }
      })
    });
    await loadTenantData(selectedΕπιχείρησηId);
  };

  const checkReadiness = async (invoiceId: string) => {
    const result = await api<{ readiness: { ready: boolean; errors: string[]; warnings: string[] } }>(
      `/invoices/${invoiceId}/readiness?organizationId=${selectedΕπιχείρησηId}`
    );
    const errors = result.readiness.errors.length;
    const warnings = result.readiness.warnings.length;
    setMessage(result.readiness.ready ? `Έτοιμο για πάροχο με ${warnings} προειδοποίηση(εις)` : `Δεν είναι έτοιμο: ${errors} σφάλμα(τα)`);
  };

  const queueΠάροχοςIssue = async (invoiceId: string) => {
    await api(`/invoices/${invoiceId}/issue-provider`, {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedΕπιχείρησηId,
        provider: providerCredentials[0]?.provider
      })
    });
    await loadTenantData(selectedΕπιχείρησηId);
  };

  const createDraftInvoice = async () => {
    const customer = customers[0];
    const template = invoiceTemplates.find((item) => item.id === selectedTemplateId);
    const firstSeries = series[0];
    if (!customer || !template || !firstSeries) throw new Error("Δημιούργησε πρώτα πελάτη και σειρά παραστατικών");

    await api<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedΕπιχείρησηId,
        customerId: customer.id,
        seriesId: firstSeries.id,
        documentType: firstSeries.documentType,
        lines: [{ description: template.description, quantity: 1, unitPrice: templatePrice, vatRate: template.vatRate, vatCategory: "VAT_24", classificationType: template.classificationType, classificationCategory: template.classificationCategory }]
      })
    });
    await loadTenantData(selectedΕπιχείρησηId);
  };

  const issueWrappStaging = async (invoiceId: string) => {
    if (!wrappAdminKey) throw new Error("Συμπλήρωσε πρώτα το staging admin key");
    await api(`/invoices/${invoiceId}/issue-wrapp-staging`, {
      method: "POST",
      headers: { "X-ERP-ADMIN-KEY": wrappAdminKey },
      body: JSON.stringify({ organizationId: selectedΕπιχείρησηId })
    });
    await loadTenantData(selectedΕπιχείρησηId);
  };

  const issueInvoice = async (invoiceId: string) => {
    await api<Invoice>(`/invoices/${invoiceId}/issue-local`, {
      method: "POST",
      body: JSON.stringify({ organizationId: selectedΕπιχείρησηId })
    });
    await loadTenantData(selectedΕπιχείρησηId);
  };

  return (
    <main classΕπωνυμία="workspace">
      <aside classΕπωνυμία="sidebar">
        <div classΕπωνυμία="brand">
          <div classΕπωνυμία="brand-mark">
            <Landmark size={23} />
          </div>
          <div>
            <strong>Ελληνικό ERP</strong>
            <span>Τιμολόγηση</span>
          </div>
        </div>
        <nav>
          <a href="#overview"><ReceiptText size={18} />Επισκόπηση</a>
          <a href="#customers"><Users size={18} />Πελάτες</a>
          <a href="#products"><Package size={18} />Προϊόντα</a>
          <a href="#invoices"><FileText size={18} />Παραστατικά</a>
        </nav>
        <div classΕπωνυμία="sidebar-note">
          <span>Ροή myDATA</span>
          <strong>ERP - Πάροχος - ΑΑΔΕ</strong>
        </div>
      </aside>

      <section classΕπωνυμία="content">
        <header classΕπωνυμία="hero" id="overview">
          <div>
            <span classΕπωνυμία="eyebrow">Χώρος εργασίας</span>
            <h1>{selectedΕπιχείρηση?.name || "Ελληνικό ERP Starter"}</h1>
            <p>Έκδοση παραστατικών, αρίθμηση και ασφαλής διαβίβαση.</p>
            <div classΕπωνυμία="hero-insights">
              <div><ShieldΈλεγχος size={18} /><span>Σύνδεση παρόχου</span></div>
              <div><Clock3 size={18} /><span>Ασφαλής αποστολή</span></div>
              <div><TrendingUp size={18} /><span>{money(totalIssued)} εκδομένα</span></div>
            </div>
          </div>
          <div classΕπωνυμία="tenant-card">
            <span>Ενεργή επιχείρηση</span>
            <select value={selectedΕπιχείρησηId} onChange={(event) => setSelectedΕπιχείρησηId(event.target.value)}>
              <option value="">Επιλογή επιχείρησης</option>
              {organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
            <div classΕπωνυμία="system-state"><ΈλεγχοςCircle2 size={17} />{message}</div>
          </div>
        </header>

        <section classΕπωνυμία="metrics">
          <Metric icon={<Users />} label="Πελάτες" value={customers.length} />
          <Metric icon={<Package />} label="Προϊόντα" value={products.length} />
          <Metric icon={<FileText />} label="Drafts" value={draftΠαραστατικά.length} />
          <Metric icon={<ReceiptText />} label="Issued total" value={money(totalIssued)} />
          <Metric icon={<PlugZap />} label="Πάροχοςs" value={providerCredentials.length} />
        </section>

        <section classΕπωνυμία="template-panel">
          <div><span classΕπωνυμία="eyebrow">Γρήγορη έκδοση</span><h2>Τι θέλεις να τιμολογήσεις;</h2><p>Διάλεξε πρότυπο. Οι φορολογικές προεπιλογές συμπληρώνονται αυτόματα.</p></div>
          <div classΕπωνυμία="template-grid">{invoiceTemplates.map((template) => <button type="button" key={template.id} classΕπωνυμία={selectedTemplateId === template.id ? "template-card selected" : "template-card"} onClick={() => { setSelectedTemplateId(template.id); setTemplatePrice(template.price); }}><strong>{template.title}</strong><span>{template.description}</span><small>ΦΠΑ {template.vatRate}%</small></button>)}</div>
          <div classΕπωνυμία="template-actions"><label>Τιμή χωρίς ΦΠΑ<input type="number" min="0" step="0.01" value={templatePrice} onChange={(event) => setTemplatePrice(Number(event.target.value))} /></label><button disabled={busy || !selectedΕπιχείρησηId} onClick={() => runAction(createDraftInvoice, "Το πρόχειρο δημιουργήθηκε")}><FilePlus2 size={18} />Δημιουργία πρόχειρο</button></div>
        </section>

        <section classΕπωνυμία="command-strip">
          <button classΕπωνυμία="secondary" disabled={busy || !selectedΕπιχείρησηId} onClick={() => runAction(createDraftInvoice, "Το πρόχειρο δημιουργήθηκε")}>
            <FilePlus2 size={18} />Νέο πρόχειρο
          </button>
          <button classΕπωνυμία="secondary" disabled={busy || !selectedΕπιχείρησηId} onClick={() => runAction(() => loadTenantData(selectedΕπιχείρησηId), "Τα δεδομένα ανανεώθηκαν")}>
            <ΑνανέωσηCw size={18} />Ανανέωση
          </button>
        </section>

        <section classΕπωνυμία="board">
          <Panel title="Επιχείρηση" icon={<Building2 size={19} />}>
            <form classΕπωνυμία="form-grid" onSubmit={(event) => runAction(() => createΕπιχείρηση(event), "Η επιχείρηση αποθηκεύτηκε")}>
              <label classΕπωνυμία="wide">Επωνυμία<input name="name" defaultValue="My First ERP Company" required /></label>
              <label>ΑΦΜ<input name="vatNumber" defaultValue="099999999" /></label>
              <label>ΔΟΥ<input name="taxOffice" defaultValue="DOY ATHINON" /></label>
              <label>Διεύθυνση<input name="address" defaultValue="Sarantaporou 7" /></label>
              <label>Πόλη<input name="city" defaultValue="Korydallos" /></label>
              <label>Τ.Κ.<input name="postalΚωδικός" defaultValue="18100" /></label>
              <label>Χώρα<input name="country" defaultValue="GR" required /></label>
              <button disabled={busy}>Save</button>
            </form>
          </Panel>

          <Panel title="Customer" icon={<Users size={19} />} id="customers">
            <form classΕπωνυμία="form-grid" onSubmit={(event) => runAction(() => createCustomer(event), "Ο πελάτης αποθηκεύτηκε")}>
              <label>ΑΦΜ<input value={customerVat} onChange={(event) => setCustomerVat(event.target.value)} /></label>
              <button type="button" classΕπωνυμία="secondary" disabled={busy || !customerVat} onClick={() => runAction(lookupVat, "Ο έλεγχος ΑΦΜ ολοκληρώθηκε")}>
                <Search size={17} />Έλεγχος
              </button>
              <label classΕπωνυμία="wide">Επωνυμία<input value={customerΕπωνυμία} onChange={(event) => setCustomerΕπωνυμία(event.target.value)} required /></label>
              {vatΈλεγχος ? (
                <div classΕπωνυμία={`lookup ${vatΈλεγχος.valid ? "valid" : "invalid"}`}>
                  {vatΈλεγχος.source}: {vatΈλεγχος.valid ? "valid VAT" : "not valid for VIES"}{vatΈλεγχος.address ? ` · ${vatΈλεγχος.address}` : ""}
                </div>
              ) : null}
              <button classΕπωνυμία="wide" disabled={busy || !selectedΕπιχείρησηId}>Αποθήκευση πελάτη</button>
            </form>
          </Panel>

          <Panel title="Προϊόν ή υπηρεσία" icon={<Package size={19} />} id="products">
            <form classΕπωνυμία="form-grid" onSubmit={(event) => runAction(() => createProduct(event), "Το προϊόν αποθηκεύτηκε")}>
              <label>Κωδικός<input name="code" defaultValue={`SERV-${String(products.length + 1).padStart(3, "0")}`} /></label>
              <label>Επωνυμία<input name="name" defaultValue="ERP consulting service" required /></label>
              <label>Τιμή μονάδας<input name="unitPrice" type="number" min="0" step="0.01" defaultValue="100" required /></label>
              <label>ΦΠΑ %<input name="vatRate" type="number" min="0" step="0.01" defaultValue="24" required /></label>
              <button classΕπωνυμία="wide" disabled={busy || !selectedΕπιχείρησηId}>Αποθήκευση προϊόντος</button>
            </form>
          </Panel>

          <Panel title="Σειρά παραστατικών" icon={<ReceiptText size={19} />}>
            <form classΕπωνυμία="form-grid" onSubmit={(event) => runAction(() => createSeries(event), "Η σειρά αποθηκεύτηκε")}>
              <label>Κωδικός<input name="code" defaultValue={series.length ? `A${series.length + 1}` : "TP"} required /></label>
              <label>Τύπος παραστατικού<input name="documentType" defaultValue="1.1" required /></label>
              <label>Σειρά Wrapp<input name="providerBillingBookId" placeholder="UUID from Wrapp" /></label>
              <label>Επόμενος αριθμός<input name="nextNumber" type="number" min="1" defaultValue="1" required /></label>
              <button classΕπωνυμία="wide" disabled={busy || !selectedΕπιχείρησηId}>Αποθήκευση σειράς</button>
            </form>
          </Panel>

          <Panel title="Πάροχος" icon={<PlugZap size={19} />}>
            <form classΕπωνυμία="form-grid" onSubmit={(event) => runAction(() => saveΠάροχοςCredential(event), "Ο πάροχος αποθηκεύτηκε")}>
              <label>Πάροχος<input name="provider" defaultValue="sandbox-yphahes" required /></label>
              <label>Περιβάλλον<select name="environment" defaultValue="SANDBOX"><option>SANDBOX</option><option>PRODUCTION</option></select></label>
              <label classΕπωνυμία="wide">API key<input name="apiKey" defaultValue="sandbox-placeholder" /></label>
              <button classΕπωνυμία="wide" disabled={busy || !selectedΕπιχείρησηId}>Save Πάροχος</button>
            </form>
          </Panel>
        </section>

        <section classΕπωνυμία="command-strip"><label>Κλειδί διαχειριστή Wrapp staging<input type="password" value={wrappAdminKey} onChange={(event) => setWrappAdminKey(event.target.value)} placeholder="Απαιτείται μόνο για έκδοση" /></label></section>

        <section classΕπωνυμία="invoice-section" id="invoices">
          <div classΕπωνυμία="section-title">
            <div>
              <span classΕπωνυμία="eyebrow">Μητρώο παραστατικών</span>
              <h2>Παραστατικά</h2>
            </div>
            <div classΕπωνυμία="register-total">{invoices.length} εγγραφές</div>
          </div>
          <div classΕπωνυμία="invoice-list">
            {invoices.length === 0 ? <div classΕπωνυμία="empty">Δεν υπάρχουν παραστατικά.</div> : invoices.map((invoice) => (
              <article classΕπωνυμία="invoice-card" key={invoice.id}>
                <div>
                  <strong>{invoice.series.code}{invoice.invoiceNumber ? `-${invoice.invoiceNumber}` : " πρόχειρο"}</strong>
                  <span>{invoice.customer?.name || "Χωρίς πελάτη"} / {invoice.documentType}</span>
                </div>
                <div classΕπωνυμία="amounts">
                  <span>Καθαρή αξία {money(invoice.netAmount)}</span>
                  <span>ΦΠΑ {money(invoice.vatAmount)}</span>
                  <strong>{money(invoice.totalAmount)}</strong>
                </div>
                <div classΕπωνυμία="invoice-actions">
                  <span classΕπωνυμία={`pill ${invoice.status.toLowerCase()}`}>{invoice.status}</span>
                  {invoice.status === "DRAFT" || invoice.status === "READY" ? (
                    <>
                      <button classΕπωνυμία="secondary" disabled={busy} onClick={() => runAction(() => checkReadiness(invoice.id), "Readiness checked")}>
                        <ΈλεγχοςCircle2 size={17} />Έλεγχος
                      </button>
                      <button disabled={busy} onClick={() => runAction(() => queueΠάροχοςIssue(invoice.id), "Η αποστολή προς πάροχο μπήκε σε αναμονή")}>
                        <PlugZap size={17} />Πάροχος
                      </button>
                      <button disabled={busy || !wrappAdminKey} onClick={() => runAction(() => issueWrappStaging(invoice.id), "Το παραστατικό εκδόθηκε μέσω Wrapp staging")}>
                        <Send size={17} />Wrapp staging
                      </button>
                      <button classΕπωνυμία="secondary" disabled={busy} onClick={() => runAction(() => issueInvoice(invoice.id), "Το παραστατικό εκδόθηκε τοπικά")}>
                        Τοπική έκδοση
                      </button>
                    </>
                  ) : <span classΕπωνυμία="provider">{invoice.mydataMark ? `MARK ${invoice.mydataMark}` : (invoice.providerStatus || "Πάροχος pending")}</span>}
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
  return <div classΕπωνυμία="metric"><div>{icon}</div><span>{label}</span><strong>{value}</strong></div>;
}

function Panel({ children, icon, id, title }: { children: React.ReactNode; icon: React.ReactNode; id?: string; title: string }) {
  return <section classΕπωνυμία="panel" id={id}><h2>{icon}{title}</h2>{children}</section>;
}
