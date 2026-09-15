"use client";

import {
  Building2,
  CheckCircle2,
  Clock3,
  FilePlus2,
  FileText,
  Landmark,
  Package,
  PlugZap,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TrendingUp,
  Users
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Organization = { id: string; name: string; country: string };
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
type ProviderCredential = {
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
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });

  if (!response.ok) throw new Error(await response.text());
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
  const [vatLookup, setVatLookup] = useState<VatLookup | null>(null);
  const [customerName, setCustomerName] = useState("Acme Greek Customer");
  const [customerVat, setCustomerVat] = useState("099999999");
  const [wrappAdminKey, setWrappAdminKey] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("service");
  const [templatePrice, setTemplatePrice] = useState(100);

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrganizationId),
    [organizations, selectedOrganizationId]
  );
  const issuedInvoices = invoices.filter((invoice) => invoice.status === "ISSUED");
  const draftInvoices = invoices.filter((invoice) => invoice.status === "DRAFT" || invoice.status === "READY");
  const totalIssued = issuedInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);

  const loadOrganizations = async () => {
    const data = await api<Organization[]>("/organizations");
    setOrganizations(data);
    setSelectedOrganizationId((current) => current || data[0]?.id || "");
  };

  const loadTenantData = async (organizationId: string) => {
    if (!organizationId) return;
    const [customerData, productData, seriesData, invoiceData, providerData] = await Promise.all([
      api<Customer[]>(`/customers?organizationId=${organizationId}`),
      api<Product[]>(`/products?organizationId=${organizationId}`),
      api<InvoiceSeries[]>(`/invoice-series?organizationId=${organizationId}`),
      api<Invoice[]>(`/invoices?organizationId=${organizationId}`),
      api<ProviderCredential[]>(`/provider-credentials?organizationId=${organizationId}`)
    ]);
    setCustomers(customerData);
    setProducts(productData);
    setSeries(seriesData);
    setInvoices(invoiceData);
    setProviderCredentials(providerData);
  };

  useEffect(() => {
    loadOrganizations().catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadTenantData(selectedOrganizationId).catch((error) => setMessage(error.message));
  }, [selectedOrganizationId]);

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

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api<Product>("/products", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        code: form.get("code") || null,
        name: form.get("name"),
        unit: "hour",
        unitPrice: Number(form.get("unitPrice")),
        vatRate: Number(form.get("vatRate"))
      })
    });
    await loadTenantData(selectedOrganizationId);
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

  const createDraftInvoice = async () => {
    const customer = customers[0];
    const template = invoiceTemplates.find((item) => item.id === selectedTemplateId);
    const firstSeries = series[0];
    if (!customer || !template || !firstSeries) throw new Error("Δημιούργησε πρώτα πελάτη και σειρά παραστατικών");

    await api<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify({
        organizationId: selectedOrganizationId,
        customerId: customer.id,
        seriesId: firstSeries.id,
        documentType: firstSeries.documentType,
        lines: [{ description: template.description, quantity: 1, unitPrice: templatePrice, vatRate: template.vatRate, vatCategory: "VAT_24", classificationType: template.classificationType, classificationCategory: template.classificationCategory }]
      })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const issueWrappStaging = async (invoiceId: string) => {
    if (!wrappAdminKey) throw new Error("Συμπλήρωσε πρώτα το staging admin key");
    await api(`/invoices/${invoiceId}/issue-wrapp-staging`, {
      method: "POST",
      headers: { "X-ERP-ADMIN-KEY": wrappAdminKey },
      body: JSON.stringify({ organizationId: selectedOrganizationId })
    });
    await loadTenantData(selectedOrganizationId);
  };

  const issueInvoice = async (invoiceId: string) => {
    await api<Invoice>(`/invoices/${invoiceId}/issue-local`, {
      method: "POST",
      body: JSON.stringify({ organizationId: selectedOrganizationId })
    });
    await loadTenantData(selectedOrganizationId);
  };

  return (
    <main className="workspace">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
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
        <div className="sidebar-note">
          <span>Ροή myDATA</span>
          <strong>ERP - Πάροχος - ΑΑΔΕ</strong>
        </div>
      </aside>

      <section className="content">
        <header className="hero" id="overview">
          <div>
            <span className="eyebrow">Χώρος εργασίας</span>
            <h1>{selectedOrganization?.name || "Ελληνικό ERP"}</h1>
            <p>Έκδοση παραστατικών, αρίθμηση και ασφαλής διαβίβαση.</p>
            <div className="hero-insights">
              <div><ShieldCheck size={18} /><span>Σύνδεση παρόχου</span></div>
              <div><Clock3 size={18} /><span>Ασφαλής αποστολή</span></div>
              <div><TrendingUp size={18} /><span>{money(totalIssued)} issued</span></div>
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
          <Metric icon={<Users />} label="Customers" value={customers.length} />
          <Metric icon={<Package />} label="Products" value={products.length} />
          <Metric icon={<FileText />} label="Drafts" value={draftInvoices.length} />
          <Metric icon={<ReceiptText />} label="Issued total" value={money(totalIssued)} />
          <Metric icon={<PlugZap />} label="Providers" value={providerCredentials.length} />
        </section>

        <section className="template-panel">
          <div><span className="eyebrow">Γρήγορη έκδοση</span><h2>Τι θέλεις να τιμολογήσεις;</h2><p>Διάλεξε πρότυπο. Οι φορολογικές προεπιλογές συμπληρώνονται αυτόματα.</p></div>
          <div className="template-grid">{invoiceTemplates.map((template) => <button type="button" key={template.id} className={selectedTemplateId === template.id ? "template-card selected" : "template-card"} onClick={() => { setSelectedTemplateId(template.id); setTemplatePrice(template.price); }}><strong>{template.title}</strong><span>{template.description}</span><small>ΦΠΑ {template.vatRate}%</small></button>)}</div>
          <div className="template-actions"><label>Τιμή χωρίς ΦΠΑ<input type="number" min="0" step="0.01" value={templatePrice} onChange={(event) => setTemplatePrice(Number(event.target.value))} /></label><button disabled={busy || !selectedOrganizationId} onClick={() => runAction(createDraftInvoice, "Το πρόχειρο δημιουργήθηκε")}><FilePlus2 size={18} />Δημιουργία draft</button></div>
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

          <Panel title="Προϊόν ή υπηρεσία" icon={<Package size={19} />} id="products">
            <form className="form-grid" onSubmit={(event) => runAction(() => createProduct(event), "Το προϊόν αποθηκεύτηκε")}>
              <label>Κωδικός<input name="code" defaultValue={`SERV-${String(products.length + 1).padStart(3, "0")}`} /></label>
              <label>Επωνυμία<input name="name" defaultValue="ERP consulting service" required /></label>
              <label>Τιμή μονάδας<input name="unitPrice" type="number" min="0" step="0.01" defaultValue="100" required /></label>
              <label>ΦΠΑ %<input name="vatRate" type="number" min="0" step="0.01" defaultValue="24" required /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId}>Αποθήκευση προϊόντος</button>
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

          <Panel title="Πάροχος" icon={<PlugZap size={19} />}>
            <form className="form-grid" onSubmit={(event) => runAction(() => saveProviderCredential(event), "Ο πάροχος αποθηκεύτηκε")}>
              <label>Πάροχος<input name="provider" defaultValue="sandbox-yphahes" required /></label>
              <label>Περιβάλλον<select name="environment" defaultValue="SANDBOX"><option>SANDBOX</option><option>PRODUCTION</option></select></label>
              <label className="wide">API key<input name="apiKey" defaultValue="sandbox-placeholder" /></label>
              <button className="wide" disabled={busy || !selectedOrganizationId}>Αποθήκευση παρόχου</button>
            </form>
          </Panel>
        </section>

        <section className="command-strip"><label>Κλειδί διαχειριστή Wrapp staging<input type="password" value={wrappAdminKey} onChange={(event) => setWrappAdminKey(event.target.value)} placeholder="Required only to issue" /></label></section>

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
                  <span>{invoice.customer?.name || "No customer"} / {invoice.documentType}</span>
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
                      <button disabled={busy || !wrappAdminKey} onClick={() => runAction(() => issueWrappStaging(invoice.id), "Το παραστατικό εκδόθηκε μέσω Wrapp staging")}>
                        <Send size={17} />Wrapp staging
                      </button>
                      <button className="secondary" disabled={busy} onClick={() => runAction(() => issueInvoice(invoice.id), "Το παραστατικό εκδόθηκε τοπικά")}>
                        Local
                      </button>
                    </>
                  ) : <span className="provider">{invoice.mydataMark ? `MARK ${invoice.mydataMark}` : (invoice.providerStatus || "Provider pending")}</span>}
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
