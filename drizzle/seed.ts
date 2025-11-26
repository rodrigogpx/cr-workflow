import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { users } from './schema';
import { hashPassword } from '../server/_core/auth';

async function main() {
  console.log('🌱 Seeding database...');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variables.');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable.');
    process.exit(1);
  }

  try {
    const db = drizzle(dbUrl);

    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists.');
      return;
    }

    const hashedPassword = await hashPassword(adminPassword);

    await db.insert(users).values({
      name: 'Admin',
      email: adminEmail,
      hashedPassword: hashedPassword,
      role: 'admin',
      perfil: 'admin',
    });

    console.log('✅ Admin user created successfully.');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

main().finally(() => {
  process.exit(0);
});
