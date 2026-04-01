/**
 * Pre-push script: adiciona constraints que o drizzle-kit push perguntaria
 * interativamente. Rodando antes do push, o drizzle-kit vê que já existem
 * e não faz prompts.
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

const constraints = [
  `DO $$ BEGIN
     ALTER TABLE "planDefinitions"
       ADD CONSTRAINT "planDefinitions_slug_unique" UNIQUE ("slug");
   EXCEPTION WHEN duplicate_object THEN NULL;
   END $$;`,
];

for (const stmt of constraints) {
  try {
    await sql.unsafe(stmt);
    console.log('[pre-push] Constraint aplicado com sucesso.');
  } catch (err) {
    // Se falhar (ex: dados duplicados), apenas avisa — drizzle-kit vai lidar depois
    console.warn('[pre-push] Aviso:', err.message);
  }
}

await sql.end();
console.log('[pre-push] Concluído.');
