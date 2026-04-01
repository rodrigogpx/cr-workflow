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
  // Excluir views/tabelas criadas por extensões do PostgreSQL no Railway
  tablesFilter: ["!pg_stat*", "!pg_statio*"],
  extensionsFilters: ["postgis"],
  entities: {
    roles: false,
  },
});
