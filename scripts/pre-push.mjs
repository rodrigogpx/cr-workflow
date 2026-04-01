/**
 * Pre-push script: aplica constraints via SQL e executa drizzle-kit push
 * com respostas automáticas para evitar travamento em CI/CD sem TTY (Railway).
 *
 * Problema: drizzle-kit 0.31.x exibe um prompt interativo ("truncate table?")
 * ao adicionar unique constraints em tabelas com dados, mesmo com --force.
 * Sem TTY, o processo trava indefinidamente.
 *
 * Solução: este script roda drizzle-kit push como subprocesso, conectando
 * stdin a um pipe e enviando Enter (seleção do default = "No, don't truncate")
 * periodicamente, para que qualquer prompt seja respondido automaticamente.
 *
 * Uso: node scripts/pre-push.mjs
 */
import postgres from 'postgres';
import { spawn } from 'child_process';

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn('[pre-push] DATABASE_URL não definida, pulando.');
  process.exit(0);
}

// ── Etapa 1: pré-criar constraints para minimizar prompts ──────────────────
const sql = postgres(url, { max: 1, idle_timeout: 5 });

const constraints = [
  `DO $$ BEGIN
     ALTER TABLE "clients"
       ADD CONSTRAINT "clients_tenantId_cpf_unique" UNIQUE ("tenantId", "cpf");
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;`,

  `DO $$ BEGIN
     ALTER TABLE "planDefinitions"
       ADD CONSTRAINT "planDefinitions_slug_unique" UNIQUE ("slug");
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;`,

  `DO $$ BEGIN
     ALTER TABLE "usageSnapshots"
       ADD CONSTRAINT "usageSnapshots_tenantId_snapshotDate_unique" UNIQUE ("tenantId", "snapshotDate");
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;`,
];

let ok = 0;
for (const stmt of constraints) {
  try {
    await sql.unsafe(stmt);
    ok++;
  } catch (err) {
    console.warn('[pre-push] Aviso SQL:', err.message);
  }
}
await sql.end();
console.log(`[pre-push] Etapa 1 concluída — ${ok}/${constraints.length} constraints criados/verificados.`);

// ── Etapa 2: executar drizzle-kit push com respostas automáticas ───────────
console.log('[pre-push] Etapa 2: executando drizzle-kit push --force com auto-resposta...');

const drizzle = spawn('drizzle-kit', ['push', '--force'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env },
});

// Enviar Enter repetidamente para auto-selecionar a opção padrão
// ("No, add the constraint without truncating the table") em qualquer prompt.
const keepEntering = setInterval(() => {
  try {
    drizzle.stdin.write('\n');
  } catch {
    // stdin pode estar fechado se o processo já encerrou
  }
}, 300);

const exitCode = await new Promise((resolve) => {
  drizzle.on('exit', (code) => {
    clearInterval(keepEntering);
    try { drizzle.stdin.end(); } catch { /* ignorar */ }
    resolve(code ?? 0);
  });
  drizzle.on('error', (err) => {
    clearInterval(keepEntering);
    console.error('[pre-push] Erro ao executar drizzle-kit:', err.message);
    resolve(1);
  });
});

if (exitCode !== 0) {
  console.error(`[pre-push] drizzle-kit push encerrou com código ${exitCode}`);
  process.exit(exitCode);
}

console.log('[pre-push] drizzle-kit push concluído com sucesso.');
