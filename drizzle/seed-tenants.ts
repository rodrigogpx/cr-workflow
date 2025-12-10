import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { tenants } from "./schema";
import { encryptSecret } from "../server/config/crypto.util";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[seed-tenants] DATABASE_URL not set");
    process.exit(1);
  }

  const client = postgres(url);
  const db = drizzle(client);

  const mocks = [
    {
      slug: "tiroesp",
      name: "Clube de Tiro Esportivo SP",
      dbHost: "localhost",
      dbPort: 5432,
      dbName: "cac360_tiroesp",
      dbUser: "tiroesp_user",
      dbPassword: encryptSecret("tiroesp_pass"),
      primaryColor: "#1a5c00",
      secondaryColor: "#4d9702",
      featureWorkflowCR: true,
      featureApostilamento: true,
      featureRenovacao: true,
      featureInsumos: false,
      plan: "professional" as const,
      subscriptionStatus: "active" as const,
      subscriptionExpiresAt: null,
      maxUsers: 20,
      maxClients: 1000,
      maxStorageGB: 100,
      isActive: true,
    },
    {
      slug: "cluberio",
      name: "Clube Tiro Rio",
      dbHost: "localhost",
      dbPort: 5432,
      dbName: "cac360_cluberio",
      dbUser: "cluberio_user",
      dbPassword: encryptSecret("cluberio_pass"),
      primaryColor: "#002366",
      secondaryColor: "#4169E1",
      featureWorkflowCR: true,
      featureApostilamento: false,
      featureRenovacao: false,
      featureInsumos: false,
      plan: "starter" as const,
      subscriptionStatus: "trial" as const,
      subscriptionExpiresAt: null,
      maxUsers: 5,
      maxClients: 100,
      maxStorageGB: 50,
      isActive: true,
    },
    {
      slug: "norteclub",
      name: "Clube Norte CAC",
      dbHost: "localhost",
      dbPort: 5432,
      dbName: "cac360_norteclub",
      dbUser: "norte_user",
      dbPassword: encryptSecret("norte_pass"),
      primaryColor: "#0f172a",
      secondaryColor: "#10b981",
      featureWorkflowCR: true,
      featureApostilamento: true,
      featureRenovacao: false,
      featureInsumos: true,
      plan: "enterprise" as const,
      subscriptionStatus: "active" as const,
      subscriptionExpiresAt: null,
      maxUsers: 50,
      maxClients: 5000,
      maxStorageGB: 500,
      isActive: true,
    },
  ];

  for (const t of mocks) {
    const exists = await db.select().from(tenants).where(tenants.slug.eq(t.slug)).limit(1);
    if (exists.length > 0) {
      console.log(`[seed-tenants] Skip existing ${t.slug}`);
      continue;
    }
    await db.insert(tenants).values(t);
    console.log(`[seed-tenants] Inserted ${t.slug}`);
  }

  await client.end();
  console.log("[seed-tenants] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
