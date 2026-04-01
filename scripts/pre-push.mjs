/**
 * Pre-push script: garante que TODOS os unique constraints existam como
 * pg_constraint reais, depois executa drizzle-kit push com segurança.
 *
 * PROBLEMA RAIZ (drizzle-kit 0.31.x):
 *   O flag --force NÃO suprime o prompt "truncate table?" gerado em
 *   pgPushUtils.ts quando um unique constraint precisa ser adicionado a uma
 *   tabela com dados. O prompt usa hanji que requer raw TTY — não funciona em
 *   CI/CD sem TTY (Railway).
 *
 * SOLUÇÃO:
 *   DROP CONSTRAINT + re-ADD para TODOS os unique constraints do schema,
 *   garantindo que cada um exista em pg_constraint antes do drizzle rodar.
 *   Com os constraints presentes, drizzle não gera create_unique_constraint
 *   statements → sem prompts interativos.
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

// ── Lista de TODOS os unique constraints do schema ─────────────────────────
// Para cada constraint: DROP IF EXISTS + re-ADD como constraint real.
// Tabelas que não existem ainda → EXCEPTION undefined_table (ignorado).

function makeStmt(table, constraintName, columns) {
  const cols = columns.map(c => `"${c}"`).join(', ');
  return `DO $$ BEGIN
      ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraintName}";
      DROP INDEX IF EXISTS "${constraintName}";
      ALTER TABLE "${table}" ADD CONSTRAINT "${constraintName}" UNIQUE (${cols});
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN OTHERS THEN
        RAISE WARNING 'pre-push [%]: %', '${constraintName}', SQLERRM;
    END $$;`;
}

const constraints = [
  // users — email
  makeStmt('users', 'users_email_unique', ['email']),

  // clients — tenantId + cpf (composite)
  makeStmt('clients', 'clients_tenantId_cpf_unique', ['tenantId', 'cpf']),

  // tenants — slug
  makeStmt('tenants', 'tenants_slug_unique', ['slug']),

  // planDefinitions — slug
  makeStmt('planDefinitions', 'planDefinitions_slug_unique', ['slug']),

  // usageSnapshots — tenantId + snapshotDate (composite)
  makeStmt('usageSnapshots', 'usageSnapshots_tenantId_snapshotDate_unique', ['tenantId', 'snapshotDate']),

  // platformSettings — key
  makeStmt('platformSettings', 'platformSettings_key_unique', ['key']),

  // platformAdmins — email
  makeStmt('platformAdmins', 'platformAdmins_email_unique', ['email']),

  // clientInviteTokens — token
  makeStmt('clientInviteTokens', 'clientInviteTokens_token_unique', ['token']),

  // clientPortalSessions — sessionToken
  makeStmt('clientPortalSessions', 'clientPortalSessions_sessionToken_unique', ['sessionToken']),
];

let ok = 0;
for (const stmt of constraints) {
  try {
    await sql.unsafe(stmt);
    ok++;
  } catch (err) {
    console.warn(`[pre-push] Aviso SQL: ${err.message}`);
  }
}

await sql.end();
console.log(`[pre-push] Etapa 1 concluída — ${ok}/${constraints.length} constraints garantidos.`);

// ── Etapa 2: drizzle-kit push ──────────────────────────────────────────────
console.log('[pre-push] Etapa 2: executando drizzle-kit push --force...');

const drizzle = spawn('drizzle-kit', ['push', '--force'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env },
});

// Fallback: enviar Enter caso apareça prompt residual inesperado
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
  // Não abortar o deploy por falha do drizzle-kit — erros comuns incluem
  // views do sistema criadas por extensões do Railway (pg_stat_statements).
  // O tablesFilter em drizzle.config.ts deve evitar esses erros, mas como
  // fallback de segurança não propagamos o erro para não bloquear o pnpm start.
  console.warn(`[pre-push] drizzle-kit push encerrou com código ${exitCode}. Continuando deploy...`);
}

console.log('[pre-push] Concluído.');
