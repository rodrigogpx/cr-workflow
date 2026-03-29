import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerPortalRoutes } from "./portalRouter";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDocumentsBaseDir } from "../fileStorage";
import { authenticatedFileServing } from "./fileAuth";
import { installRouter } from "../install/router";
import { ensureMissingTables } from "../ensure-tables";
import { tenantApiRouter } from "./tenantApi";
import { startCronJobs } from "../cron";
import { ensurePortalAndMarketingTables, createLead } from "../db";

// SECURITY: Simple in-memory rate limiter for auth endpoints (no external deps)
const _rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX = 20; // 20 attempts per window

// Cleanup stale entries every 30 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of _rateLimitStore) {
    if (val.resetAt <= now) _rateLimitStore.delete(key);
  }
}, 30 * 60 * 1000).unref();

function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";
  const now = Date.now();
  const entry = _rateLimitStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    _rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfter.toString());
    return res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
  }
  return next();
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Ensure critical tables exist (migration fix)
  await ensureMissingTables();
  await ensurePortalAndMarketingTables();

  const app = express();
  const server = createServer(app);
  const installWizardEnabled =
    (process.env.INSTALL_WIZARD_ENABLED ?? "true").toLowerCase() !== "false";

  // SECURITY: Restrict CORS origin in production to configured domain(s)
  const isProduction = process.env.NODE_ENV === "production";
  // Normalize DOMAIN — aceita com ou sem protocolo (ex: "cac360.com.br" ou "https://hml.cac360.com.br")
  const rawDomain = process.env.DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(o => o.trim().replace(/\/$/, ""))
    : (rawDomain ? [`https://${rawDomain}`, `https://hml.${rawDomain}`] : []);

  // SECURITY: Fail-fast if no origins configured in production — wildcard CORS with credentials is dangerous
  if (isProduction && allowedOrigins.length === 0) {
    throw new Error("[SECURITY] CORS_ORIGINS ou DOMAIN não configurados. Defina pelo menos uma variável de ambiente antes de iniciar em produção.");
  }

  app.use(
    cors({
      origin: !isProduction
        ? (process.env.DEV_CORS_ORIGIN ?? 'http://localhost:5173')
        : allowedOrigins,
      credentials: true,
    })
  );

  // SECURITY: Basic security headers (equivalent to helmet basics)
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Content-Security-Policy: compatível com Vite SPA + analytics opcional + Google Fonts
    // 'unsafe-inline' em script-src é necessário para o snippet de analytics do index.html
    // e para chunks do Vite que injetam inline em alguns builds
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self'",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
      ].join("; ")
    );
    if (isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });

  // Health check endpoint para Railway/Docker/Swarm
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve client document files from Volume (when DOCUMENTS_STORAGE_DIR is set)
  // SECURITY: Files are served through authenticated middleware — not express.static
  if (process.env.DOCUMENTS_STORAGE_DIR) {
    app.use("/files", authenticatedFileServing());
  }

  // SECURITY: Rate limit auth endpoints — 20 attempts per 15 min per IP
  app.use("/api/oauth", authRateLimiter);
  app.use("/api/trpc/auth.login", authRateLimiter);
  app.use("/api/trpc/auth.platformLogin", authRateLimiter);
  app.use("/api/trpc/auth.register", authRateLimiter);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Portal do Cliente — rotas públicas self-service
  registerPortalRoutes(app);

  // SECURITY: Install wizard is gated by env var AND checks isPlatformInstalled() internally.
  // Once installed, the /complete endpoint rejects with 409.
  if (installWizardEnabled) {
    app.use("/api/install", installRouter);
  }

  // Tenant Management API (REST)
  app.use("/api/tenants", tenantApiRouter);

  // Rota pública — captura de leads do formulário de demonstração (landing page)
  app.post("/api/public/leads", async (req: Request, res: Response) => {
    try {
      const { name, clubName, email, whatsapp, message } = req.body ?? {};
      if (!name || !email) {
        return res.status(400).json({ error: "Nome e email são obrigatórios." });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return res.status(400).json({ error: "Email inválido." });
      }
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        ?? req.socket.remoteAddress ?? undefined;
      const leadId = await createLead({ name, clubName, email, whatsapp, message, ipAddress: ip });

      // Notificar admin por email (fire-and-forget)
      const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SMTP_USER;
      if (adminEmail) {
        const { sendEmail } = await import("../emailService");
        sendEmail({
          to: adminEmail,
          subject: `[CAC 360] Novo lead: ${name} (${clubName ?? "sem clube"})`,
          html: `<div style="font-family:sans-serif;max-width:600px">
            <h3 style="color:#123A63">Novo lead pela landing page</h3>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:4px 8px;font-weight:bold">Nome</td><td>${name}</td></tr>
              <tr><td style="padding:4px 8px;font-weight:bold">Clube</td><td>${clubName ?? "—"}</td></tr>
              <tr><td style="padding:4px 8px;font-weight:bold">Email</td><td>${email}</td></tr>
              <tr><td style="padding:4px 8px;font-weight:bold">WhatsApp</td><td>${whatsapp ?? "—"}</td></tr>
              <tr><td style="padding:4px 8px;font-weight:bold">Mensagem</td><td>${message ?? "—"}</td></tr>
            </table>
            <p style="color:#888;font-size:12px">Lead #${leadId} — ${new Date().toLocaleString("pt-BR")}</p>
          </div>`,
        } as any).catch((e: any) => console.error("[Leads] Email admin:", e));
      }

      return res.json({ success: true, leadId });
    } catch (err) {
      console.error("[Leads] Erro ao salvar lead:", err);
      return res.status(500).json({ error: "Erro ao processar solicitação." });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Na Railway (ou outros PaaS), NUNCA podemos trocar a porta se ela vier do process.env.PORT
  let port = parseInt(process.env.PORT || "3000");
  
  if (process.env.NODE_ENV === "development" && !process.env.PORT) {
    port = await findAvailablePort(port);
  }

  server.listen(port, "0.0.0.0", () => {
    // Server running
    startCronJobs();
  });
}

startServer().catch(console.error);
