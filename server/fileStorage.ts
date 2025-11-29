import fs from "fs/promises";
import path from "path";

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
  fileName: string;
  buffer: Buffer;
}): Promise<{ key: string; fullPath: string; publicPath: string; size: number }> {
  const safeName = sanitizeFileName(params.fileName);

  // Estrutura: clients/<clientId>/<timestamp>-<fileName>
  const relDir = path.join("clients", String(params.clientId));
  const relKey = path.join(relDir, `${Date.now()}-${safeName}`);
  const fullPath = path.join(DOCUMENTS_BASE_DIR, relKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, params.buffer);

  // URL pública servida pelo Express em /files
  const publicPath = `/files/${relKey.replace(/\\/g, "/")}`;

  return {
    key: relKey,
    fullPath,
    publicPath,
    size: params.buffer.length,
  };
}
