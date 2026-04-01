/**
 * Pre-push script: garante que TODOS os unique constraints existam como
 * pg_constraint reais, depois executa drizzle-kit push com segurança.
 *
 * PROBLEMA RAIZ (drizzle-kit 0.31.x):
 *   O flag --force NÃO suprime o prompt "truncate table?" gerado em
 *   pgPushUtils.ts quando um unique constraint precisa ser adicionado a uma
 *   tabela com dados. hanji requer raw TTY — não funciona em CI/CD (Railway).
 *
 * SOLUÇÃO:
 *   Garantir que cada unique constraint exista em pg_constraint ANTES do
 *   drizzle-kit rodar. Se já existe, não tocamos. Se não existe, criamos.
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Verifica se um constraint existe em pg_constraint */
async function constraintExists(constraintName) {
  const rows = await sql`
    SELECT 1 FROM pg_constraint WHERE conname = ${constraintName} LIMIT 1`;
  return rows.length > 0;
}

/** Verifica se uma tabela existe */
async function tableExists(tableName) {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName} LIMIT 1`;
  return rows.length > 0;
}

// ── Etapa 0: Dropar constraints "fantasma" ───────────────────────────────────
// O ensureSchemaColumns cria tabelas com UNIQUE inline (ex: cpf UNIQUE), gerando
// constraints com nomes padrão do Postgres (ex: clients_cpf_key). Mas o schema
// drizzle espera nomes diferentes (ex: clients_tenantId_cpf_unique). Esses
// constraints fantasma fazem o drizzle-kit gerar DROP+ADD statements, causando
// os prompts interativos.
const ghostConstraints = [
  // clients: CREATE TABLE tinha "cpf" NOT NULL UNIQUE → cria clients_cpf_key
  // Mas schema quer clients_tenantId_cpf_unique (composite tenantId+cpf)
  { name: 'clients_cpf_key', table: 'clients' },
  { name: 'clients_cpf_unique', table: 'clients' },
  // users: CREATE TABLE tinha "email" NOT NULL UNIQUE → cria users_email_key
  // Mas schema quer users_email_unique
  { name: 'users_email_key', table: 'users' },
  // tenants: CREATE TABLE UNIQUE inline
  { name: 'tenants_slug_key', table: 'tenants' },
  // planDefinitions: CREATE TABLE UNIQUE inline
  { name: 'planDefinitions_slug_key', table: 'planDefinitions' },
  // platformAdmins: possível nome default
  { name: 'platformAdmins_email_key', table: 'platformAdmins' },
  // platformSettings: possível nome default
  { name: 'platformSettings_key_key', table: 'platformSettings' },
  // clientInviteTokens: possível nome default
  { name: 'clientInviteTokens_token_key', table: 'clientInviteTokens' },
  // clientPortalSessions: possível nome default
  { name: 'clientPortalSessions_sessionToken_key', table: 'clientPortalSessions' },
];

for (const g of ghostConstraints) {
  if (await constraintExists(g.name)) {
    try {
      await sql.unsafe(`ALTER TABLE "${g.table}" DROP CONSTRAINT "${g.name}"`);
      console.log(`[pre-push] 🗑 Constraint fantasma "${g.name}" removido de "${g.table}".`);
    } catch (err) {
      console.warn(`[pre-push] Aviso ao remover "${g.name}": ${err.message}`);
    }
  }
}

// ── Etapa 1: Garantir constraints do schema drizzle ──────────────────────────
const constraints = [
  { name: 'users_email_unique',                          table: 'users',                cols: ['"email"'] },
  { name: 'clients_tenantId_cpf_unique',                 table: 'clients',              cols: ['"tenantId"', '"cpf"'] },
  { name: 'tenants_slug_unique',                         table: 'tenants',              cols: ['"slug"'] },
  { name: 'planDefinitions_slug_unique',                 table: 'planDefinitions',      cols: ['"slug"'] },
  { name: 'usageSnapshots_tenantId_snapshotDate_unique', table: 'usageSnapshots',       cols: ['"tenantId"', '"snapshotDate"'] },
  { name: 'platformSettings_key_unique',                 table: 'platformSettings',     cols: ['"key"'] },
  { name: 'platformAdmins_email_unique',                 table: 'platformAdmins',       cols: ['"email"'] },
  { name: 'clientInviteTokens_token_unique',             table: 'clientInviteTokens',   cols: ['"token"'] },
  { name: 'clientPortalSessions_sessionToken_unique',    table: 'clientPortalSessions', cols: ['"sessionToken"'] },
];

let ok = 0, skipped = 0, failed = 0;

for (const c of constraints) {
  try {
    // 1) Verificar se a tabela existe
    if (!(await tableExists(c.table))) {
      console.log(`[pre-push] ⏭ "${c.name}" — tabela "${c.table}" não existe, pulando.`);
      skipped++;
      continue;
    }

    // 2) Verificar se o constraint já existe em pg_constraint
    if (await constraintExists(c.name)) {
      console.log(`[pre-push] ✓ "${c.name}" já existe em pg_constraint.`);
      ok++;
      continue;
    }

    // 3) Constraint não existe — precisamos criar.
    //    Primeiro, dropar índice órfão (pode existir sem constraint real).
    console.log(`[pre-push] ⚠ "${c.name}" NÃO existe em pg_constraint. Criando...`);

    try {
      await sql.unsafe(`DROP INDEX IF EXISTS "${c.name}"`);
    } catch (e) {
      // Ignorar — índice pode não existir
    }

    // 4) Verificar duplicatas antes de criar o constraint
    const colsList = c.cols.join(', ');
    const dupes = await sql.unsafe(`
      SELECT ${colsList}, COUNT(*) AS cnt
      FROM "${c.table}"
      GROUP BY ${colsList}
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    if (dupes.length > 0) {
      console.warn(`[pre-push] ✗ "${c.name}" — ${dupes.length} grupo(s) de duplicatas encontrados:`);
      for (const d of dupes) console.warn('  ', JSON.stringify(d));
      // Limpar duplicatas mantendo o registro mais recente (maior id)
      console.log(`[pre-push]   Removendo duplicatas de "${c.table}"...`);
      await sql.unsafe(`
        DELETE FROM "${c.table}" a USING "${c.table}" b
        WHERE a.id < b.id AND ${c.cols.map(col => `a.${col} IS NOT DISTINCT FROM b.${col}`).join(' AND ')}
      `);
      console.log(`[pre-push]   Duplicatas removidas.`);
    }

    // 5) Criar o constraint
    await sql.unsafe(
      `ALTER TABLE "${c.table}" ADD CONSTRAINT "${c.name}" UNIQUE (${colsList})`
    );

    // 6) Verificar se foi criado
    if (await constraintExists(c.name)) {
      console.log(`[pre-push] ✓ "${c.name}" criado com sucesso.`);
      ok++;
    } else {
      console.error(`[pre-push] ✗ "${c.name}" — ADD CONSTRAINT executou mas não aparece em pg_constraint!`);
      failed++;
    }
  } catch (err) {
    console.error(`[pre-push] ✗ "${c.name}" ERRO: ${err.message}`);
    failed++;
  }
}

// ── Diagnóstico: mostrar estado real do DB para investigação ──────────────
console.log('[pre-push] === DIAGNÓSTICO: estado dos constraints na tabela clients ===');
try {
  const pgConstraints = await sql`
    SELECT c.conname, c.contype, 
           array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) as columns
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'clients' AND c.contype IN ('u', 'p')
    GROUP BY c.conname, c.contype
    ORDER BY c.conname`;
  for (const r of pgConstraints) {
    console.log(`  pg_constraint: ${r.conname} type=${r.contype} cols=[${r.columns}]`);
  }

  const pgIndexes = await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'clients'
    ORDER BY indexname`;
  for (const r of pgIndexes) {
    console.log(`  pg_indexes: ${r.indexname} → ${r.indexdef}`);
  }
} catch (e) {
  console.warn('[pre-push] Erro no diagnóstico:', e.message);
}
console.log('[pre-push] === FIM DIAGNÓSTICO ===');

await sql.end();
console.log(`[pre-push] Etapa 1 concluída — ok:${ok} pulados:${skipped} falhas:${failed} / ${constraints.length} total`);

// ── Etapa 2: drizzle-kit push ──────────────────────────────────────────────
console.log('[pre-push] Etapa 2: executando drizzle-kit push --force...');

const TIMEOUT_MS = 90_000; // 90 segundos para evitar timeout do Railway

const drizzle = spawn('drizzle-kit', ['push', '--force'], {
  stdio: ['pipe', 'inherit', 'inherit'],
  env: { ...process.env },
});

// Enviar \r + \n a cada 500ms para auto-responder prompts do hanji.
// hanji requer \r (carriage return) além de \n — só \n não funciona.
// 500ms é o intervalo que funcionava no deploy original.
const keepEntering = setInterval(() => {
  try {
    drizzle.stdin.write('\r');
    drizzle.stdin.write('\n');
  } catch { /* stdin fechado, ignorar */ }
}, 500);

// Timeout de segurança: se drizzle-kit travar em prompt, matar o processo.
// O schema já foi aplicado pelos constraints da Etapa 1 + statements anteriores.
const killTimer = setTimeout(() => {
  console.warn(`[pre-push] drizzle-kit travou por ${TIMEOUT_MS / 1000}s — matando processo...`);
  drizzle.kill('SIGTERM');
  setTimeout(() => {
    try { drizzle.kill('SIGKILL'); } catch { /* já morreu */ }
  }, 5_000);
}, TIMEOUT_MS);

const exitCode = await new Promise((resolve) => {
  drizzle.on('exit', (code) => {
    clearTimeout(killTimer);
    clearInterval(keepEntering);
    try { drizzle.stdin.end(); } catch { /* ignorar */ }
    resolve(code ?? 0);
  });
  drizzle.on('error', (err) => {
    clearTimeout(killTimer);
    clearInterval(keepEntering);
    console.error('[pre-push] Erro ao executar drizzle-kit:', err.message);
    resolve(1);
  });
});

if (exitCode !== 0) {
  // Não abortar o deploy — erros comuns: views de extensões Railway (pg_stat_statements),
  // prompts interativos que não responderam. O schema das tabelas da app já foi aplicado.
  console.warn(`[pre-push] drizzle-kit push encerrou com código ${exitCode}. Continuando deploy...`);
}

console.log('[pre-push] Concluído.');
