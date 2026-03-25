/// <reference types="node" />
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const fsPromises = fs.promises;

/**
 * Base directory for storing client documents.
 *
 * In Railway, configure a Volume (for exemplo montado em /data)
 * e defina a env DOCUMENTS_STORAGE_DIR=/data/documents.
 *
 * Em desenvolvimento local, cai no fallback ./documents.
 */
const DOCUMENTS_BASE_DIR = process.env.DOCUMENTS_STORAGE_DIR
  ? path.resolve(process.env.DOCUMENTS_STORAGE_DIR)
  : path.resolve(process.cwd(), "documents");

function sanitizeFileName(name: string): string {
  // Remove caracteres problemáticos de caminho
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getDocumentsBaseDir(): string {
  return DOCUMENTS_BASE_DIR;
}

export async function saveClientDocumentFile(params: {
  clientId: number;
  tenantId?: number;
  fileName: string;
  buffer: Buffer;
}): Promise<{ key: string; fullPath: string; publicPath: string; size: number }> {
  const safeName = sanitizeFileName(params.fileName);

  // SECURITY: Validate that clientId and tenantId are positive integers to prevent path traversal
  if (!Number.isInteger(params.clientId) || params.clientId <= 0) {
    throw new Error("[FileStorage] Invalid clientId");
  }
  if (params.tenantId !== undefined && (!Number.isInteger(params.tenantId) || params.tenantId <= 0)) {
    throw new Error("[FileStorage] Invalid tenantId");
  }

  // Estrutura: 
  // Multi-tenant: tenants/<tenantId>/clients/<clientId>/<timestamp>-<fileName>
  // Legado/Sem tenant: clients/<clientId>/<timestamp>-<fileName>
  
  let relDir: string;
  if (params.tenantId) {
    relDir = path.join("tenants", String(params.tenantId), "clients", String(params.clientId));
  } else {
    relDir = path.join("clients", String(params.clientId));
  }

  const relKey = path.join(relDir, `${Date.now()}-${safeName}`);
  const fullPath = path.resolve(DOCUMENTS_BASE_DIR, relKey);

  // SECURITY: Ensure resolved path is within DOCUMENTS_BASE_DIR (prevent path traversal)
  const normalizedBase = path.resolve(DOCUMENTS_BASE_DIR);
  if (!fullPath.startsWith(normalizedBase + path.sep)) {
    throw new Error("[FileStorage] Path traversal detected — file rejected");
  }

  await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.promises.writeFile(fullPath, params.buffer);

  // URL pública servida pelo Express em /files
  // Nota: O servidor deve estar configurado para servir DOCUMENTS_BASE_DIR em /files
  const publicPath = `/files/${relKey.replace(/\\/g, "/")}`;

  return {
    key: relKey,
    fullPath,
    publicPath,
    size: params.buffer.length,
  };
}

/**
 * Calcula o tamanho total (em bytes) dos arquivos armazenados para um determinado tenant.
 */
export async function getTenantStorageUsage(tenantId: number): Promise<number> {
  const tenantDir = path.join(DOCUMENTS_BASE_DIR, "tenants", String(tenantId));
  
  try {
    await fs.promises.access(tenantDir);
  } catch {
    return 0; // Diretório não existe, uso é 0
  }

  let totalSize = 0;

  async function calculateDirSize(dirPath: string) {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await calculateDirSize(fullPath);
      } else {
        const stats = await fs.promises.stat(fullPath);
        totalSize += stats.size;
      }
    }
  }

  await calculateDirSize(tenantDir);
  return totalSize;
}

/**
 * Calcula o tamanho total (em bytes) de todos os arquivos em documents (global).
 */
export async function getGlobalStorageUsage(): Promise<number> {
  let totalSize = 0;

  async function calculateDirSize(dirPath: string) {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await calculateDirSize(fullPath);
        } else {
          const stats = await fs.promises.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (e) {
      console.warn(`[Storage] Erro ao ler diretório ${dirPath}:`, e);
    }
  }

  await calculateDirSize(DOCUMENTS_BASE_DIR);
  return totalSize;
}
