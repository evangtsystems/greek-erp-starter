import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../../packages/database/src/client.js";
import { encryptSecret, verifyWrappWebhook } from "../services/wrapp-security.js";

export const wrappRouter = Router();

const onboardingSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  phone: z.string().min(6),
  webhookEndpoint: z.string().url().optional()
});

const webhookSchema = z.object({
  wrapp_user_id: z.string().min(1),
  partner_user_id: z.string().min(1),
  api_key: z.string().min(1)
});

function baseUrl() {
  return (process.env.WRAPP_BASE_URL ?? "https://staging.wrapp.ai/api/v1").replace(/\/$/, "");
}

wrappRouter.post("/onboarding", async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const partnerKey = process.env.WRAPP_PARTNER_API_KEY;
  if (!partnerKey) return res.status(500).json({ error: "WRAPP_PARTNER_API_KEY is not configured" });

  const organization = await prisma.organization.findUnique({ where: { id: parsed.data.organizationId } });
  if (!organization?.vatNumber) {
    return res.status(422).json({ error: "The organization needs a VAT number before Wrapp onboarding" });
  }

  const partnerUserId = organization.vatNumber;
  const credential = await prisma.providerCredential.findUnique({
    where: {
      organizationId_provider_environment: {
        organizationId: organization.id,
        provider: "WRAPP",
        environment: "SANDBOX"
      }
    }
  });

  const previousPartnerUserId = (credential?.metadata as Record<string, unknown> | null)?.partnerUserId;
  if (previousPartnerUserId && previousPartnerUserId !== partnerUserId) {
    return res.status(409).json({ error: "Wrapp partner_user_id is immutable and does not match this organization's VAT number" });
  }

  const webhookEndpoint = parsed.data.webhookEndpoint ?? process.env.WRAPP_WEBHOOK_ENDPOINT;
  const payload = {
    email: parsed.data.email,
    phone: parsed.data.phone,
    partner_user_id: partnerUserId,
    ...(webhookEndpoint ? { webhook_endpoint: webhookEndpoint } : {}),
    company_vat_no: organization.vatNumber,
    company_name: organization.name,
    company_city: organization.city ?? undefined,
    company_address: organization.address ?? undefined,
    company_postal_code: organization.postalCode ?? undefined
  };

  try {
    const response = await fetch(`${baseUrl()}/external_login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PARTNER-API-KEY": partnerKey
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.login_url) {
      return res.status(502).json({ error: "Wrapp onboarding request failed", providerResponse: body });
    }

    await prisma.providerCredential.upsert({
      where: {
        organizationId_provider_environment: {
          organizationId: organization.id,
          provider: "WRAPP",
          environment: "SANDBOX"
        }
      },
      create: {
        organizationId: organization.id,
        provider: "WRAPP",
        environment: "SANDBOX",
        enabled: false,
        credentials: {},
        metadata: { partnerUserId, email: parsed.data.email, wrappStatus: "ONBOARDING" } as Prisma.InputJsonObject
      },
      update: {
        metadata: { ...(credential?.metadata as Record<string, unknown> ?? {}), partnerUserId, email: parsed.data.email, wrappStatus: "ONBOARDING" } as Prisma.InputJsonObject
      }
    });

    res.status(201).json({ partnerUserId, loginUrl: body.login_url, status: "ONBOARDING" });
  } catch {
    res.status(502).json({ error: "Could not reach Wrapp staging API" });
  }
});

wrappRouter.post("/webhooks/user-created", async (req, res) => {
  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody) || !verifyWrappWebhook(rawBody, req.header("X-Webhook-Secret") ?? undefined)) {
    return res.status(401).json({ error: "Invalid Wrapp webhook signature" });
  }

  const parsed = webhookSchema.safeParse(JSON.parse(rawBody.toString("utf8")));
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const organization = await prisma.organization.findFirst({ where: { vatNumber: parsed.data.partner_user_id } });
  if (!organization) return res.status(404).json({ error: "Organization not found for partner_user_id" });

  const metadata = {
    partnerUserId: parsed.data.partner_user_id,
    wrappUserId: parsed.data.wrapp_user_id,
    wrappStatus: "ACTIVE"
  } as Prisma.InputJsonObject;

  await prisma.providerCredential.upsert({
    where: {
      organizationId_provider_environment: {
        organizationId: organization.id,
        provider: "WRAPP",
        environment: "SANDBOX"
      }
    },
    create: {
      organizationId: organization.id,
      provider: "WRAPP",
      environment: "SANDBOX",
      enabled: true,
      credentials: { tenantApiKeyEncrypted: encryptSecret(parsed.data.api_key) } as Prisma.InputJsonObject,
      metadata
    },
    update: {
      enabled: true,
      credentials: { tenantApiKeyEncrypted: encryptSecret(parsed.data.api_key) } as Prisma.InputJsonObject,
      metadata
    }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      entityType: "provider_credential",
      entityId: organization.id,
      action: "WRAPP_ONBOARDING_COMPLETED",
      newData: { provider: "WRAPP", environment: "SANDBOX", wrappUserId: parsed.data.wrapp_user_id }
    }
  });

  res.status(204).end();
});
