import type { Request, Response, NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { sdk } from "./sdk";
import { COOKIE_NAME, PLATFORM_COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { getDocumentsBaseDir } from "../fileStorage";
import { getTenantConfig } from "../config/tenant.config";

/**
 * Middleware de autenticação para servir arquivos.
 * 
 * Valida:
 * 1. Sessão válida (cookie JWT)
 * 2. Platform admins têm acesso a todos os arquivos
 * 3. Tenant users só acessam arquivos do seu tenant
 * 4. Path traversal prevention
 */
export function authenticatedFileServing() {
  const baseDir = getDocumentsBaseDir();

  return async (req: Request, res: Response, next: NextFunction) => {
    // Parse cookies
    const cookieHeader = req.headers.cookie;
    const cookies = cookieHeader
      ? new Map(Object.entries(parseCookieHeader(cookieHeader)))
      : new Map<string, string>();

    // Try platform admin session first
    const platformCookie = cookies.get(PLATFORM_COOKIE_NAME);
    const platformSession = await sdk.verifySession(platformCookie);

    if (platformSession?.isPlatformAdmin) {
      // Platform admins can access all files — serve directly
      return serveFileSecurely(req, res, baseDir);
    }

    // Try tenant user session
    const userCookie = cookies.get(COOKIE_NAME);
    const userSession = await sdk.verifySession(userCookie);

    if (!userSession) {
      return res.status(401).json({ error: "Autenticação necessária para acessar arquivos" });
    }

    // Extract tenant ID from the requested file path
    // Paths follow: /files/tenants/<tenantId>/clients/<clientId>/<file>
    // Or legacy:    /files/clients/<clientId>/<file>
    const requestedPath = decodeURIComponent(req.path);
    const tenantMatch = requestedPath.match(/^\/tenants\/(\d+)\//);

    if (tenantMatch) {
      const fileTenantId = parseInt(tenantMatch[1], 10);

      if (!userSession.tenantSlug) {
        return res.status(403).json({ error: "Acesso negado: sessão sem contexto de tenant" });
      }

      // SECURITY: Resolve tenantSlug → tenantId and verify it matches the file path.
      // getTenantConfig is cached (5 min TTL), so this adds minimal overhead.
      try {
        const tenantConfig = await getTenantConfig(userSession.tenantSlug);
        if (!tenantConfig || tenantConfig.id !== fileTenantId) {
          console.warn(`[FileAuth] Tenant mismatch: session=${tenantConfig?.id} file=${fileTenantId}`);
          return res.status(403).json({ error: "Acesso negado: arquivo não pertence ao seu tenant" });
        }
      } catch {
        return res.status(403).json({ error: "Acesso negado" });
      }

      return serveFileSecurely(req, res, baseDir);
    }

    // Legacy path (no tenant prefix) — allow if user has valid session
    return serveFileSecurely(req, res, baseDir);
  };
}

/**
 * Serve a file securely, preventing path traversal attacks.
 */
function serveFileSecurely(req: Request, res: Response, baseDir: string) {
  const requestedPath = decodeURIComponent(req.path);

  // Resolve the full path and ensure it's within baseDir (prevent path traversal)
  const fullPath = path.resolve(baseDir, "." + requestedPath);
  const normalizedBase = path.resolve(baseDir);

  if (!fullPath.startsWith(normalizedBase + path.sep) && fullPath !== normalizedBase) {
    console.warn(`[FileAuth] Path traversal attempt blocked: ${requestedPath}`);
    return res.status(403).json({ error: "Acesso negado" });
  }

  // Check file exists
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return res.status(404).json({ error: "Arquivo não encontrado" });
  }

  // Serve the file
  return res.sendFile(fullPath);
}
