import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as db from "../db";
import { hashPassword } from "./auth";
import { invalidateTenantCache } from "../config/tenant.config";

export const tenantApiRouter = express.Router();

// Middleware to verify Platform API Key
const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  const validApiKey = process.env.PLATFORM_API_KEY;

  if (!validApiKey) {
    return res.status(500).json({ error: "Platform API key is not configured" });
  }

  if (apiKey !== validApiKey) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  next();
};

tenantApiRouter.use(requireApiKey);

// Validation schemas
const createTenantSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(255),
  adminName: z.string().min(2).max(255),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  plan: z.enum(['starter', 'professional', 'enterprise']).default('starter'),
  maxUsers: z.number().default(10),
  maxClients: z.number().default(500),
  featureWorkflowCR: z.boolean().default(true),
  featureApostilamento: z.boolean().default(false),
  featureRenovacao: z.boolean().default(false),
  featureInsumos: z.boolean().default(false),
  subscriptionStatus: z.enum(['active', 'suspended', 'trial', 'cancelled']).default('trial'),
});

const updateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  maxUsers: z.number().optional(),
  maxClients: z.number().optional(),
  featureWorkflowCR: z.boolean().optional(),
  featureApostilamento: z.boolean().optional(),
  featureRenovacao: z.boolean().optional(),
  featureInsumos: z.boolean().optional(),
  subscriptionStatus: z.enum(['active', 'suspended', 'trial', 'cancelled']).optional(),
  isActive: z.boolean().optional(),
});

// 1. List Tenants
tenantApiRouter.get("/", async (_req: express.Request, res: express.Response) => {
  try {
    const tenants = await db.getAllTenants();
    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Get Tenant
tenantApiRouter.get("/:slug", async (req: express.Request, res: express.Response) => {
  try {
    const tenant = await db.getTenantBySlug(req.params.slug);
    if (!tenant) {
      return res.status(404).json({ success: false, error: "Tenant not found" });
    }
    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Create Tenant
tenantApiRouter.post("/", async (req: express.Request, res: express.Response) => {
  try {
    const data = createTenantSchema.parse(req.body);

    const existing = await db.getTenantBySlug(data.slug);
    if (existing) {
      return res.status(409).json({ success: false, error: "Slug already in use" });
    }

    const existingUser = await db.getUserByEmail(data.adminEmail);
    if (existingUser) {
      return res.status(409).json({ success: false, error: "Admin email already registered" });
    }

    // Default db config for single-db mode
    const isSingleDbMode = process.env.TENANT_DB_MODE === 'single';
    let dbConfig = {
      dbHost: 'localhost',
      dbPort: 5432,
      dbName: `cac360_${data.slug}`,
      dbUser: '',
      dbPassword: '',
    };

    if (isSingleDbMode && process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        dbConfig = {
          dbHost: url.hostname,
          dbPort: Number(url.port || 5432),
          dbName: (url.pathname || '').replace(/^\//, ''),
          dbUser: decodeURIComponent(url.username || ''),
          dbPassword: decodeURIComponent(url.password || ''),
        };
      } catch { /* ignore */ }
    }

    const tenantId = await db.createTenant({
      slug: data.slug,
      name: data.name,
      ...dbConfig,
      featureWorkflowCR: data.featureWorkflowCR,
      featureApostilamento: data.featureApostilamento,
      featureRenovacao: data.featureRenovacao,
      featureInsumos: data.featureInsumos,
      plan: data.plan,
      maxUsers: data.maxUsers,
      maxClients: data.maxClients,
      subscriptionStatus: data.subscriptionStatus,
      isActive: true,
    });

    const hashedPassword = await hashPassword(data.adminPassword);
    await db.upsertUser({
      tenantId,
      name: data.adminName,
      email: data.adminEmail,
      hashedPassword,
      role: 'admin',
    });

    invalidateTenantCache(data.slug);

    res.status(201).json({ success: true, data: { id: tenantId, slug: data.slug } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Update Tenant
tenantApiRouter.patch("/:slug", async (req: express.Request, res: express.Response) => {
  try {
    const data = updateTenantSchema.parse(req.body);
    const tenant = await db.getTenantBySlug(req.params.slug);
    
    if (!tenant) {
      return res.status(404).json({ success: false, error: "Tenant not found" });
    }

    await db.updateTenant(tenant.id, data);
    invalidateTenantCache(tenant.slug);

    res.json({ success: true, data: { id: tenant.id, slug: tenant.slug } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Suspend/Activate Tenant
tenantApiRouter.post("/:slug/status", async (req: express.Request, res: express.Response) => {
  try {
    const statusSchema = z.object({
      status: z.enum(['active', 'suspended', 'trial', 'cancelled'])
    });
    
    const { status } = statusSchema.parse(req.body);
    const tenant = await db.getTenantBySlug(req.params.slug);
    
    if (!tenant) {
      return res.status(404).json({ success: false, error: "Tenant not found" });
    }

    await db.updateTenant(tenant.id, { subscriptionStatus: status });
    invalidateTenantCache(tenant.slug);

    res.json({ success: true, data: { id: tenant.id, status } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});
