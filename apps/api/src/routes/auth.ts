import { Router } from "express";
import { scryptSync, timingSafeEqual, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { clearErpSession, getErpSession, isErpAdmin, setErpSession } from "../services/erp-session.js";

export const authRouter = Router();
const loginSchema = z.object({ email: z.string().email().optional(), password: z.string().min(1) });

function verifyPassword(password: string, encoded: string) {
  const [algorithm, saltHex, hashHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

authRouter.get("/session", (req, res) => {
  let session = getErpSession(req);
  const hasSessionCookie = Boolean(req.headers.cookie?.match(/(?:^|; )erp_session=/));
  if (!session && hasSessionCookie && isErpAdmin(req)) {
    setErpSession(res);
    session = { userId: null, email: null, name: "Administrator", role: "ADMIN", expiresAt: Date.now() + 12 * 60 * 60 * 1000 };
  }
  const authenticated = isErpAdmin(req);
  res.json({
    authenticated,
    user: session ? { id: session.userId, email: session.email, name: session.name, role: session.role } : authenticated ? { id: null, email: null, name: "Administrator", role: "ADMIN" } : null
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(401).json({ error: "Μη έγκυρα στοιχεία σύνδεσης" });

  const { email, password } = parsed.data;
  if (email) {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: { organizations: true } });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Μη έγκυρα στοιχεία σύνδεσης" });
    }
    const role = user.organizations.some((membership) => membership.role === "OWNER") ? "OWNER" : user.organizations.some((membership) => membership.role === "ADMIN") ? "ADMIN" : user.organizations[0]?.role ?? user.role;
    setErpSession(res, { userId: user.id, email: user.email, name: user.name, role });
    return res.json({ authenticated: true, user: { id: user.id, email: user.email, name: user.name, role } });
  }

  // Legacy administrator login remains available for existing installations.
  const expected = process.env.ERP_APP_PASSWORD;
  if (!expected) return res.status(401).json({ error: "Μη έγκυρα στοιχεία σύνδεσης" });
  const actualBytes = Buffer.from(password);
  const expectedBytes = Buffer.from(expected);
  const valid = actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
  if (!valid) return res.status(401).json({ error: "Μη έγκυρα στοιχεία σύνδεσης" });
  setErpSession(res);
  return res.json({ authenticated: true, user: { id: null, email: null, name: "Administrator", role: "ADMIN" } });
});

authRouter.post("/logout", (_req, res) => {
  clearErpSession(res);
  res.status(204).end();
});
