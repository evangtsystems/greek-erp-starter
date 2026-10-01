import { randomBytes, scryptSync } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { getErpSession, requireErpUserAdmin } from "../services/erp-session.js";

export const userRouter = Router();
userRouter.use(requireErpUserAdmin);

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(["OWNER", "ADMIN", "CASHIER", "ACCOUNTANT", "VIEWER"]),
  organizationId: z.string().uuid()
});

function passwordHash(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

userRouter.get("/", async (req, res) => {
  const session = getErpSession(req);
  const organizationId = String(req.query.organizationId ?? "");
  if (session?.userId && !organizationId) return res.status(400).json({ error: "organizationId is required" });
  if (session?.userId) {
    const membership = await prisma.organizationUser.findUnique({ where: { organizationId_userId: { organizationId, userId: session.userId } } });
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return res.status(403).json({ error: "Δεν έχετε δικαίωμα διαχείρισης χρηστών" });
  }
  const users = await prisma.user.findMany({
    where: session?.userId ? { organizations: { some: { organizationId } } } : undefined,
    select: { id: true, email: true, name: true, role: true, createdAt: true, organizations: { where: session?.userId ? { organizationId } : undefined, select: { role: true } } },
    orderBy: { createdAt: "asc" }
  });
  res.json(users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    role: user.organizations.some((membership) => membership.role === "OWNER")
      ? "OWNER"
      : user.organizations.some((membership) => membership.role === "ADMIN")
        ? "ADMIN"
        : user.organizations[0]?.role ?? user.role
  })));
});

userRouter.post("/", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, password, role, organizationId } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const session = getErpSession(req);
  if (session?.userId) {
    const membership = await prisma.organizationUser.findUnique({ where: { organizationId_userId: { organizationId, userId: session.userId } } });
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return res.status(403).json({ error: "Δεν έχετε δικαίωμα διαχείρισης χρηστών" });
  } else if (!await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })) {
    return res.status(404).json({ error: "Organization not found" });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: passwordHash(password),
        role,
        organizations: { create: [{ organization: { connect: { id: organizationId } }, role }] }
      },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    res.status(201).json({ ...user, role });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return res.status(409).json({ error: "Υπάρχει ήδη χρήστης με αυτό το email" });
    }
    throw error;
  }
});
