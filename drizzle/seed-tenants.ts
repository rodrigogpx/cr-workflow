import "dotenv/config";

async function main() {
  throw new Error("Script desativado: a funcionalidade de seed mock de tenants foi removida.");
}

main().catch((err) => {
  console.error("[seed-tenants] failed:", err);
  process.exit(1);
});
