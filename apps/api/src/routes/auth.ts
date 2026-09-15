import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { clearErpSession, isErpAdmin, setErpSession } from "../services/erp-session.js";

export const authRouter = Router();
const loginSchema = z.object({ password: z.string().min(1) });

authRouter.get("/session", (req, res) => {
  res.json({ authenticated: isErpAdmin(req) });
});

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  const expected = process.env.ERP_APP_PASSWORD;
  if (!parsed.success || !expected) return res.status(401).json({ error: "Μη έγκυρα στοιχεία σύνδεσης" });
  const actual = parsed.data.password;
  const valid = actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  if (!valid) return res.status(401).json({ error: "Μη έγκυρα στοιχεία σύνδεσης" });
  setErpSession(res);
  res.json({ authenticated: true });
});

authRouter.post("/logout", (_req, res) => {
  clearErpSession(res);
  res.status(204).end();
});
