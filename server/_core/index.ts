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
    // Content-Security-Policy: restritivo mas compatível com TailwindCSS inline styles e imagens/blobs de documentos
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
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
  });
}

startServer().catch(console.error);
