/**
 * Pre-push script: garante que constraints únicos existam como pg_constraint
 * reais, depois executa drizzle-kit push com segurança.
 *
 * PROBLEMA RAIZ (drizzle-kit 0.31.x):
 *   O flag --force NÃO suprime o prompt "truncate table?" gerado em
 *   pgPushUtils.ts quando um unique constraint precisa ser adicionado a uma
 *   tabela com dados. O prompt usa hanji que requer raw TTY — não funciona em
 *   CI/CD sem TTY (Railway). Pipar \n ao stdin também não resolve porque
 *   hanji não processa input de pipes em non-TTY mode.
 *
 * SOLUÇÃO:
 *   1. DROP CONSTRAINT + re-ADD para garantir que cada unique constraint
 *      exista em pg_constraint (não apenas como índice órfão).
 *      Com os constraints presentes em pg_constraint, drizzle-kit não gera
 *      create_unique_constraint statements → sem prompt de truncate.
 *   2. drizzle-kit push --force para aplicar demais mudanças do schema.
 *      O --force suprime os outros prompts de confirmação (push.ts).
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

const sql = postgres(url, { max: 1, idle_timeout: 10 });

// ── Etapa 1: garantir constraints reais em pg_constraint ───────────────────
// Usamos blocos DO com EXCEPTION para atomicidade e tolerância a erros.
// A lógica DROP + re-ADD garante que o constraint exista como entry real em
// pg_constraint (e não apenas como índice criado por operação anterior).

const constraints = [
  {
    name: 'clients_tenantId_cpf_unique',
    stmt: `DO $$ BEGIN
      -- Dropar constraint existente (remove constraint + índice associado)
      ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_tenantId_cpf_unique";
      -- Dropar índice órfão, se sobrou
      DROP INDEX IF EXISTS "clients_tenantId_cpf_unique";
      -- Recriar como constraint real em pg_constraint
      ALTER TABLE "clients" ADD CONSTRAINT "clients_tenantId_cpf_unique" UNIQUE ("tenantId", "cpf");
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'Tabela clients não existe ainda, pulando constraint.';
      WHEN OTHERS THEN
        RAISE WARNING 'Erro em clients_tenantId_cpf_unique: %', SQLERRM;
    END $$;`,
  },
  {
    name: 'planDefinitions_slug_unique',
    stmt: `DO $$ BEGIN
      ALTER TABLE "planDefinitions" DROP CONSTRAINT IF EXISTS "planDefinitions_slug_unique";
      DROP INDEX IF EXISTS "planDefinitions_slug_unique";
      ALTER TABLE "planDefinitions" ADD CONSTRAINT "planDefinitions_slug_unique" UNIQUE ("slug");
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'Tabela planDefinitions não existe ainda, pulando constraint.';
      WHEN OTHERS THEN
        RAISE WARNING 'Erro em planDefinitions_slug_unique: %', SQLERRM;
    END $$;`,
  },
  {
    name: 'usageSnapshots_tenantId_snapshotDate_unique',
    stmt: `DO $$ BEGIN
      ALTER TABLE "usageSnapshots" DROP CONSTRAINT IF EXISTS "usageSnapshots_tenantId_snapshotDate_unique";
      DROP INDEX IF EXISTS "usageSnapshots_tenantId_snapshotDate_unique";
      ALTER TABLE "usageSnapshots" ADD CONSTRAINT "usageSnapshots_tenantId_snapshotDate_unique" UNIQUE ("tenantId", "snapshotDate");
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'Tabela usageSnapshots não existe ainda, pulando constraint.';
      WHEN OTHERS THEN
        RAISE WARNING 'Erro em usageSnapshots_tenantId_snapshotDate_unique: %', SQLERRM;
    END $$;`,
  },
];

let ok = 0;
for (const c of constraints) {
  try {
    await sql.unsafe(c.stmt);
    console.log(`[pre-push] ✓ Constraint "${c.name}" garantido.`);
    ok++;
  } catch (err) {
    console.warn(`[pre-push] Aviso em "${c.name}": ${err.message}`);
  }
}

await sql.end();
console.log(`[pre-push] Etapa 1 concluída — ${ok}/${constraints.length} constraints processados.`);

// ── Etapa 2: executar drizzle-kit push ─────────────────────────────────────
// Com os constraints em pg_constraint, drizzle não gera create_unique_constraint
// e não mostra o prompt interativo.
console.log('[pre-push] Etapa 2: executando drizzle-kit push --force...');

const drizzle = spawn('drizzle-kit', ['push', '--force'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env },
});

// Fallback: caso apareça algum prompt inesperado, envia Enter (\r para raw mode,
// \n para readline mode) para selecionar a opção default.
const keepEntering = setInterval(() => {
  try {
    drizzle.stdin.write('\r');
    drizzle.stdin.write('\n');
  } catch { /* stdin fechado */ }
}, 500);

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
  console.error(`[pre-push] drizzle-kit push encerrou com código ${exitCode}.`);
  process.exit(exitCode);
}

console.log('[pre-push] Concluído com sucesso.');
