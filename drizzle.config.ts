import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
  // Excluir views criadas pela extensão pg_stat_statements no Railway.
  // IMPORTANTE: usar UM pattern negativo. Dois patterns negativos com OR
  // não excluem nada (cada tabela matcha pelo menos um).
  tablesFilter: ["!pg_stat*"],
  entities: {
    roles: false,
  },
});
