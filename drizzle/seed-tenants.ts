import "dotenv/config";
import { seedMockTenants } from "../server/db";

async function main() {
  console.log("[seed-tenants] Running seedMockTenants via application DB layer...");

  const result = await seedMockTenants();

  console.log(
    `[seed-tenants] done: ${result.tenants} tenants, ${result.users} users, ${result.clients} clients`,
  );
}

main().catch((err) => {
  console.error("[seed-tenants] failed:", err);
  process.exit(1);
});
