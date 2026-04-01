#!/usr/bin/env node
/**
 * generate-email-templates-data.mjs
 *
 * Lê todos os arquivos .html em email-templates/ e gera
 * server/defaults/emailTemplatesData.ts com o conteúdo em base64.
 *
 * Uso: node scripts/generate-email-templates-data.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEMPLATES_DIR = resolve(ROOT, 'email-templates');
const OUTPUT_FILE = resolve(ROOT, 'server', 'defaults', 'emailTemplatesData.ts');

// Mapeamento: nome do arquivo (sem .html) → templateKey
// Se não estiver no mapa, usa o próprio nome do arquivo como chave.
const FILE_TO_KEY = {
  'welcome':                 'welcome',
  'psicotecnico':            'psicotecnico',
  'psicotecnico_agendado':   'psicotecnico_agendado',
  'psicotecnico_concluido':  'psicotecnico_concluido',
  'laudo_tecnico':           'laudo_tecnico',
  'laudo_tecnico_concluido': 'laudo_tecnico_concluido',
  'juntada_documentos':      'juntada_documentos',
  'sinarm_iniciado':         'sinarm_iniciado',
  'sinarm_protocolado':      'sinarm_solicitado',   // arquivo → chave normalizada
  'sinarm_aguardando_gru':   'sinarm_aguardando_gru',
  'sinarm_em_analise':       'sinarm_em_analise',
  'sinarm_restituido':       'sinarm_restituido',
  'sinarm_deferido':         'sinarm_deferido',
  'sinarm_indeferido':       'sinarm_indeferido',
};

// Arquivos a ignorar
const IGNORE = new Set([
  'agendamento-laudo.html',
  'process.html',
  'process.min.html',
  'status.html',
  'status.min.html',
  'welcome.min.html',
]);

const files = readdirSync(TEMPLATES_DIR)
  .filter(f => f.endsWith('.html') && !IGNORE.has(f))
  .sort();

const entries = [];
for (const file of files) {
  const fileStem = basename(file, '.html');
  const templateKey = FILE_TO_KEY[fileStem] ?? fileStem;
  const content = readFileSync(resolve(TEMPLATES_DIR, file), 'utf-8');
  const b64 = Buffer.from(content, 'utf-8').toString('base64');
  entries.push({ templateKey, title: fileStem, contentB64: b64 });
  console.log(`  ✓ ${file} → templateKey: ${templateKey} (${content.length} chars)`);
}

const tsContent = `// AUTO-GENERATED — não edite manualmente.
// Execute: node scripts/generate-email-templates-data.mjs

export interface EmailTemplateData {
  templateKey: string;
  title: string;
  contentB64: string; // base64 UTF-8
}

export const defaultEmailTemplates: EmailTemplateData[] = [
${entries.map(e => `  {
    templateKey: ${JSON.stringify(e.templateKey)},
    title: ${JSON.stringify(e.title)},
    contentB64: ${JSON.stringify(e.contentB64)},
  }`).join(',\n')}
];
`;

writeFileSync(OUTPUT_FILE, tsContent, 'utf-8');
console.log(`\n✅ Gerado: ${OUTPUT_FILE} (${entries.length} templates)`);
