import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../../../packages/database/src/client.js";

const cookieName = "erp_session";
const legacySessionValue = "authenticated";
const sessionDurationMs = 1000 * 60 * 60 * 12;

export type ErpSession = {
  userId: string | null;
  email: string | null;
  name: string | null;
  role: "OWNER" | "ADMIN" | "CASHIER" | "ACCOUNTANT" | "VIEWER";
  expiresAt: number;
};

function sessionSecret() {
  return process.env.ERP_SESSION_SECRET || process.env.ERP_APP_PASSWORD || "";
}

function sign(value: string) {
  const secret = sessionSecret();
  return secret ? createHmac("sha256", secret).update(value).digest("hex") : "";
}

function equalSignature(actual: string, expected: string) {
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function cookieValue(req: Request) {
  return req.headers.cookie?.match(new RegExp(`(?:^|; )${cookieName}=([^;]+)`))?.[1] ?? null;
}

export function getErpSession(req: Request): ErpSession | null {
  const value = cookieValue(req);
  if (!value || !sessionSecret()) return null;

  const [version, encoded, signature, extra] = value.split(".");
  if (version !== "v2" || !encoded || !signature || extra) return null;

  const expected = sign(`v2.${encoded}`);
  if (!equalSignature(signature, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ErpSession;
    if (!session.expiresAt || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function isErpAdmin(req: Request) {
  const adminKey = process.env.ERP_ADMIN_API_KEY;
  if (adminKey && req.header("X-ERP-ADMIN-KEY") === adminKey) return true;

  const session = getErpSession(req);
  if (session) return true;

  // Keep existing browser sessions valid until they expire after deployment.
  const value = cookieValue(req);
  const legacySignature = sign(legacySessionValue);
  return Boolean(value && legacySignature && equalSignature(value, legacySignature));
}

export function isErpUserAdmin(req: Request) {
  const adminKey = process.env.ERP_ADMIN_API_KEY;
  if (adminKey && req.header("X-ERP-ADMIN-KEY") === adminKey) return true;
  const session = getErpSession(req);
  return session?.role === "OWNER" || session?.role === "ADMIN";
}

export async function requireErpAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isErpAdmin(req)) return res.status(401).json({ error: "Απαιτείται σύνδεση στο ERP" });

  if (req.header("X-ERP-ADMIN-KEY")) return next();
  const session = getErpSession(req);
  if (!session || !session.userId) return next();

  // The legacy administrator session is platform-wide; named user accounts are tenant-scoped.
  if (session.userId) {
    const routePath = `${req.baseUrl}${req.path}`.replace(/^\/api/, "");
    if (routePath === "/gemi/company" || (routePath === "/organizations" && req.method === "GET")) return next();
    const organizationId = String(req.query.organizationId ?? req.body?.organizationId ?? req.params.organizationId ?? (routePath.startsWith("/organizations/") ? req.params.id : ""));
    if (!organizationId) return res.status(400).json({ error: "organizationId is required" });
    const membership = await prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId: session.userId } }
    });
    if (!membership) return res.status(403).json({ error: "Δεν έχετε πρόσβαση σε αυτή την επιχείρηση" });
  }

  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return next();

  const routePath = `${req.baseUrl}${req.path}`.replace(/^\/api/, "");
  const allowedWrites: Record<ErpSession["role"], string[]> = {
    OWNER: ["/"],
    ADMIN: ["/"],
    ACCOUNTANT: ["/customers", "/suppliers", "/invoices", "/invoice-series", "/purchases", "/payments"],
    CASHIER: ["/customers", "/invoices", "/payments", "/quotes", "/orders"],
    VIEWER: []
  };
  const canWrite = allowedWrites[session.role].some((prefix) => prefix === "/" || routePath === prefix || routePath.startsWith(`${prefix}/`));
  if (!canWrite) return res.status(403).json({ error: "אין לך הרשאה לבצע פעולה זו" });
  next();
}

export function requireErpUserAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isErpAdmin(req)) return res.status(401).json({ error: "Απαιτείται σύνδεση στο ERP" });
  if (req.header("X-ERP-ADMIN-KEY")) return next();
  const session = getErpSession(req);
  if (!session || !session.userId) return next();
  if (session.role !== "OWNER" && session.role !== "ADMIN") return res.status(403).json({ error: "Απαιτείται δικαίωμα διαχείρισης χρηστών" });
  next();
}

export function setErpSession(res: Response, user: Omit<ErpSession, "expiresAt"> | null = null) {
  const session: ErpSession = {
    userId: user?.userId ?? null,
    email: user?.email ?? null,
    name: user?.name ?? null,
    role: user?.role ?? "ADMIN",
    expiresAt: Date.now() + sessionDurationMs
  };
  const encoded = Buffer.from(JSON.stringify(session)).toString("base64url");
  const value = `v2.${encoded}.${sign(`v2.${encoded}`)}`;
  res.cookie(cookieName, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: sessionDurationMs, path: "/" });
}

export function clearErpSession(res: Response) {
  res.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}
