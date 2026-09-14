import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";

export const providerCredentialRouter = Router();

const organizationQuerySchema = z.object({
  organizationId: z.string().uuid()
});

const credentialSchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.string().min(1),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
  enabled: z.boolean().default(true),
  credentials: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).nullable().optional()
});

providerCredentialRouter.get("/", async (req, res) => {
  const parsed = organizationQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const credentials = await prisma.providerCredential.findMany({
    where: { organizationId: parsed.data.organizationId },
    select: {
      id: true,
      organizationId: true,
      provider: true,
      environment: true,
      enabled: true,
      metadata: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  res.json(credentials);
});

providerCredentialRouter.post("/", async (req, res) => {
  const parsed = credentialSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const data = parsed.data;
  const credentials = data.credentials as Prisma.InputJsonObject;
  const metadata = data.metadata ? data.metadata as Prisma.InputJsonObject : undefined;

  const credential = await prisma.providerCredential.upsert({
    where: {
      organizationId_provider_environment: {
        organizationId: data.organizationId,
        provider: data.provider,
        environment: data.environment
      }
    },
    create: {
      organizationId: data.organizationId,
      provider: data.provider,
      environment: data.environment,
      enabled: data.enabled,
      credentials,
      metadata: metadata ?? null
    },
    update: {
      enabled: data.enabled,
      credentials,
      metadata: metadata ?? null
    }
  });

  res.status(201).json({
    id: credential.id,
    organizationId: credential.organizationId,
    provider: credential.provider,
    environment: credential.environment,
    enabled: credential.enabled,
    metadata: credential.metadata,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt
  });
});
