import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const cookieName = "erp_session";
const sessionValue = "authenticated";

function signature() {
  const password = process.env.ERP_APP_PASSWORD;
  if (!password) return "";
  return createHmac("sha256", password).update(sessionValue).digest("hex");
}

export function isErpAdmin(req: Request) {
  const adminKey = process.env.ERP_ADMIN_API_KEY;
  if (adminKey && req.header("X-ERP-ADMIN-KEY") === adminKey) return true;

  const match = req.headers.cookie?.match(new RegExp(`(?:^|; )${cookieName}=([^;]+)`));
  if (!match || !signature()) return false;
  const expected = signature();
  return match[1].length === expected.length && timingSafeEqual(Buffer.from(match[1]), Buffer.from(expected));
}

export function requireErpAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isErpAdmin(req)) return res.status(401).json({ error: "Απαιτείται σύνδεση στο ERP" });
  next();
}

export function setErpSession(res: Response) {
  res.cookie(cookieName, signature(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 12, path: "/" });
}

export function clearErpSession(res: Response) {
  res.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}
