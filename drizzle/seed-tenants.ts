import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { clients, tenants, users } from "./schema";
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

  // Seed tenants
  for (const t of mocks) {
    const exists = await db.select().from(tenants).where(eq(tenants.slug, t.slug)).limit(1);
    if (exists.length > 0) {
      console.log(`[seed-tenants] Skip existing ${t.slug}`);
      continue;
    }
    await db.insert(tenants).values(t);
    console.log(`[seed-tenants] Inserted ${t.slug}`);
  }

  // Seed platform users (2 admins + 3 operadores por tenant)
  const passwordHash = bcrypt.hashSync("123456", 10);
  const tenantUserIds: Record<string, { admins: number[]; operators: number[] }> = {};

  for (const t of mocks) {
    const admins: number[] = [];
    const operators: number[] = [];

    // Admins
    for (let i = 1; i <= 2; i++) {
      const email = `${t.slug}.admin${i}@example.com`;
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        admins.push(existing[0].id);
        continue;
      }
      const [inserted] = await db
        .insert(users)
        .values({
          name: `${t.name} Admin ${i}`,
          email,
          hashedPassword: passwordHash,
          role: "admin",
        })
        .returning({ id: users.id });
      admins.push(inserted.id);
    }

    // Operadores
    for (let i = 1; i <= 3; i++) {
      const email = `${t.slug}.op${i}@example.com`;
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        operators.push(existing[0].id);
        continue;
      }
      const [inserted] = await db
        .insert(users)
        .values({
          name: `${t.name} Operador ${i}`,
          email,
          hashedPassword: passwordHash,
          role: "operator",
        })
        .returning({ id: users.id });
      operators.push(inserted.id);
    }

    tenantUserIds[t.slug] = { admins, operators };
  }

  // Seed clients (15 por tenant, atribuídos aos operadores)
  for (const t of mocks) {
    const { operators } = tenantUserIds[t.slug];
    if (operators.length === 0) continue;

    for (let i = 1; i <= 15; i++) {
      const cpf = `${String(i).padStart(3, "0")}${String(i).padStart(3, "0")}0000${String(i).padStart(2, "0")}`;
      const email = `${t.slug}.cliente${i}@example.com`;

      const existing = await db.select().from(clients).where(eq(clients.cpf, cpf)).limit(1);
      if (existing.length > 0) {
        continue;
      }

      const operatorId = operators[(i - 1) % operators.length];

      await db.insert(clients).values({
        name: `Cliente ${i} - ${t.name}`,
        cpf,
        phone: `11999${String(i).padStart(4, "0")}`,
        email,
        operatorId,
        address: "Rua Exemplo",
        addressNumber: `${100 + i}`,
        neighborhood: "Centro",
        city: "São Paulo",
        cep: "01000-000",
      });
    }
    console.log(`[seed-tenants] Inserted users/clients for ${t.slug}`);
  }

  await client.end();
  console.log("[seed-tenants] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
