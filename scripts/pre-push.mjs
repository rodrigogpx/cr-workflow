/**
 * Pre-push script: aplica constraints via SQL antes do drizzle-kit push.
 * O drizzle-kit 0.31.x pergunta interativamente ao adicionar constraints em tabelas
 * com dados — incompatível com CI/CD sem TTY (Railway).
 * Rodando este script antes, o drizzle encontra os constraints já existentes e não pergunta.
 *
 * Uso: node scripts/pre-push.mjs
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn('[pre-push] DATABASE_URL não definida, pulando.');
  process.exit(0);
}

const sql = postgres(url, { max: 1, idle_timeout: 5 });

// Todos os constraints únicos compostos/nomeados do schema que o drizzle-kit
// pode tentar adicionar interativamente em tabelas com dados existentes.
const constraints = [
  // clients — unique(tenantId, cpf)
  `DO $$ BEGIN
     ALTER TABLE "clients"
       ADD CONSTRAINT "clients_tenantId_cpf_unique" UNIQUE ("tenantId", "cpf");
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;`,

  // planDefinitions — unique(slug)
  `DO $$ BEGIN
     ALTER TABLE "planDefinitions"
       ADD CONSTRAINT "planDefinitions_slug_unique" UNIQUE ("slug");
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;`,

  // usageSnapshots — unique(tenantId, snapshotDate)
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
    console.warn('[pre-push] Aviso:', err.message);
  }
}

await sql.end();
console.log(`[pre-push] Concluído — ${ok}/${constraints.length} constraints verificados.`);
