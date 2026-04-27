/**
 * export-null-templates-as-seed.mjs
 *
 * UTILITÁRIO LOCAL — não é necessário executar no deploy.
 *
 * Em produção, o seedTenant.ts carrega automaticamente os templates com
 * tenantId = NULL do banco em runtime (sem necessidade de re-deploy).
 *
 * Use este script apenas quando precisar regenerar os arquivos TypeScript
 * estáticos de fallback (server/defaults/emailTemplatesData.ts e
 * server/defaults/defaultTemplates.ts), por exemplo após uma migração de
 * ambiente ou como backup estático dos templates.
 *
 * Uso:
 *   DATABASE_URL=<sua_url> node scripts/export-null-templates-as-seed.mjs
 *
 * Ou com .env:
 *   node --env-file=.env scripts/export-null-templates-as-seed.mjs
 */

import postgres from "postgres";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌  Defina DATABASE_URL antes de rodar o script.");
  process.exit(1);
}

const client = postgres(dbUrl, { ssl: "require", max: 1 });

/**
 * KEY_MAP — renomeia as chaves do banco para o padrão do seed/triggers.
 *
 * Lógica de nomeação:
 *  - Templates vinculados a triggers: chave = nome semântico do trigger (snake_case)
 *  - Templates sem trigger correspondente: chave descritiva no mesmo padrão (snake_case)
 *
 * Mapeamento banco → trigger → nova chave:
 *
 *  DB key (original)           | Trigger                         | Nova chave
 *  ----------------------------|----------------------------------|---------------------------
 *  boas_vindas_clube           | Boas Vindas (CLIENT_CREATED)     | welcome
 *  juntada_documentos          | Conclusão Juntada (STEP:2)       | juntada_documentos  (=)
 *  encaminhamento_psicologico  | Encaminhamento Psicotécnico(:3)  | psicotecnico
 *  avaliacao_psicologica       | Avaliação Psicológica Concluída  | psicotecnico_concluido
 *  agendamento_laudo           | Agendamento Laudo (SCHEDULE_TECH)| laudo_tecnico
 *  confirmacao_laudo           | Laudo Técnico Concluído (STEP:5) | laudo_tecnico_concluido
 *  cadastro-concluido          | (sem trigger — step 1 cadastro)  | cadastro_concluido
 *  sinarm_cac_status-solicitado| Processo Solicitado (SINARM:Soli)| sinarm_solicitado
 *  sinarm_cac_status-iniciado  | (sem trigger — status Iniciado)  | sinarm_iniciado
 *  sinarm_cac_status-analise   | Processo em Análise (SINARM:Aná) | sinarm_em_analise
 *  sinarm_cac_status-gru       | Aguardando Baixa GRU             | sinarm_aguardando_gru
 *  sinarm_cac_status-restituido| Proc. Restituído/Indeferido      | sinarm_restituido
 */
const KEY_MAP = {
  boas_vindas_clube: "welcome",
  juntada_documentos: "juntada_documentos",
  encaminhamento_psicologico: "psicotecnico",
  avaliacao_psicologica: "psicotecnico_concluido",
  agendamento_laudo: "laudo_tecnico",
  confirmacao_laudo: "laudo_tecnico_concluido",
  "cadastro-concluido": "cadastro_concluido",
  "sinarm_cac_status-solicitado": "sinarm_solicitado",
  "sinarm_cac_status-iniciado": "sinarm_iniciado",
  "sinarm_cac_status-analise": "sinarm_em_analise",
  "sinarm_cac_status-gru": "sinarm_aguardando_gru",
  "sinarm_cac_status-restituido": "sinarm_restituido",
};

/**
 * META — subject e título para cada chave FINAL (pós-renomeação).
 */
const META = {
  welcome: {
    title: "Boas Vindas",
    subject: "Bem-vindo(a) à {{nome_clube}} - {{nome}}",
  },
  juntada_documentos: {
    title: "Juntada de Documentos",
    subject: "Conclusão da Juntada de Documentos - {{nome}}",
  },
  psicotecnico: {
    title: "Encaminhamento Psicotécnico",
    subject: "Encaminhamento para Avaliação Psicológica - {{nome}}",
  },
  psicotecnico_concluido: {
    title: "Avaliação Psicológica Concluída",
    subject: "Sua Avaliação Psicológica foi recebida - {{nome}}",
  },
  laudo_tecnico: {
    title: "Agendamento Laudo Técnico",
    subject: "Agendamento de Laudo de Capacidade Técnica - {{nome}}",
  },
  laudo_tecnico_concluido: {
    title: "Laudo Técnico Concluído",
    subject: "Seu Laudo Técnico foi recebido - {{nome}}",
  },
  cadastro_concluido: {
    title: "Cadastro Concluído",
    subject: "Seu cadastro foi concluído - {{nome}}",
  },
  sinarm_solicitado: {
    title: "Status Sinarm: Processo Solicitado",
    subject: "Seu Processo CAC foi Solicitado no Sinarm - {{nome}}",
  },
  sinarm_iniciado: {
    title: "Status Sinarm: Processo Iniciado",
    subject: "Montagem do Processo CAC Iniciada - {{nome}}",
  },
  sinarm_em_analise: {
    title: "Status Sinarm: Em Análise",
    subject: "Seu Processo CAC está em Análise - {{nome}}",
  },
  sinarm_aguardando_gru: {
    title: "Status Sinarm: Aguardando Baixa GRU",
    subject: "Aguardando Baixa do Pagamento (GRU) - {{nome}}",
  },
  sinarm_restituido: {
    title: "Status Sinarm: Processo Restituído",
    subject: "Ação Necessária: Processo CAC Restituído - {{nome}}",
  },
};

async function main() {
  console.log("🔍  Buscando templates com tenantId = NULL...");

  const rows = await client`
    SELECT "templateKey", "subject", "content"
    FROM "emailTemplates"
    WHERE "tenantId" IS NULL
    ORDER BY "templateKey"
  `;

  if (rows.length === 0) {
    console.warn("⚠️  Nenhum template com tenantId = NULL encontrado.");
    await client.end();
    process.exit(0);
  }

  console.log(`✅  ${rows.length} templates encontrados.`);

  // Mapear linhas com as novas chaves padronizadas
  const mapped = rows.map(row => {
    const originalKey = row.templateKey;
    const newKey = KEY_MAP[originalKey] ?? originalKey;
    if (newKey !== originalKey) {
      console.log(`  🔑  Renomeando: "${originalKey}" → "${newKey}"`);
    }
    const meta = META[newKey] || { title: newKey, subject: "" };
    const b64 = Buffer.from(row.content || "", "utf8").toString("base64");
    return { originalKey, newKey, meta, b64 };
  });

  // ── Gerar emailTemplatesData.ts ──────────────────────────────────────────
  const dataLines = mapped.map(
    ({ newKey, meta, b64 }) =>
      `defaultEmailTemplates.push({ templateKey: ${JSON.stringify(newKey)}, title: ${JSON.stringify(meta.title)}, subject: ${JSON.stringify(meta.subject)}, contentB64: '${b64}' });`
  );

  const dataFile = [
    `// AUTO-GERADO por scripts/export-null-templates-as-seed.mjs`,
    `// Não edite manualmente — re-execute o script para atualizar.`,
    `export const defaultEmailTemplates: {templateKey: string, title: string, subject: string, contentB64: string}[] = [];`,
    ...dataLines,
    "",
  ].join("\n");

  const dataPath = join(ROOT, "server/defaults/emailTemplatesData.ts");
  writeFileSync(dataPath, dataFile, "utf8");
  console.log(`📄  Gerado: server/defaults/emailTemplatesData.ts`);

  // ── Gerar defaultTemplates.ts ────────────────────────────────────────────
  const switchCases = mapped
    .map(
      ({ newKey, meta }) =>
        `    case ${JSON.stringify(newKey)}: subject = ${JSON.stringify(meta.subject)}; title = ${JSON.stringify(meta.title)}; break;`
    )
    .join("\n");

  const templateFile = `// AUTO-GERADO por scripts/export-null-templates-as-seed.mjs
import { defaultEmailTemplates as rawTemplates } from './emailTemplatesData';

function fixDoubleUtf8(raw: string): string {
  try {
    const buf = Buffer.from(raw, 'latin1');
    const fixed = buf.toString('utf8');
    if (fixed.includes('\\uFFFD')) return raw;
    return fixed;
  } catch {
    return raw;
  }
}

export const defaultEmailTemplates = rawTemplates.map(t => {
  let subject = t.subject || '';
  let title = t.title;
  switch(t.templateKey) {
${switchCases}
  }
  const rawContent = Buffer.from(t.contentB64, 'base64').toString('utf8');
  return {
    templateKey: t.templateKey,
    templateTitle: title,
    subject,
    content: fixDoubleUtf8(rawContent),
    attachments: '[]',
    module: 'workflow-cr'
  };
});
`;

  const templatePath = join(ROOT, "server/defaults/defaultTemplates.ts");
  writeFileSync(templatePath, templateFile, "utf8");
  console.log(`📄  Gerado: server/defaults/defaultTemplates.ts`);

  await client.end();
  console.log("\n✅  Concluído! Revise os arquivos gerados e faça commit.");
  console.log("\n📋  Resumo das chaves geradas:");
  mapped.forEach(({ newKey }) => console.log(`     • ${newKey}`));
}

main().catch(err => {
  console.error("❌  Erro:", err);
  process.exit(1);
});
