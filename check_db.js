require('dotenv').config();
const postgres = require('postgres');

async function main() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    console.log('--- USERS ---');
    const users = await sql`SELECT id, name, email, role, "tenantId" FROM users LIMIT 5`;
    console.log(users);
    
    console.log('\n--- TENANTS ---');
    const tenants = await sql`SELECT id, slug, name FROM tenants LIMIT 5`;
    console.log(tenants);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
