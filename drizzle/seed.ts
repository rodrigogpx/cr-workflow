import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { users } from './schema';
import { hashPassword } from '../server/_core/auth';

async function main() {
  console.log('🌱 Seeding database...');

  // Permitir configuração via variáveis de ambiente, mas com defaults seguros para
  // ambiente de desenvolvimento/local. Em produção, sempre sobrescreva via env.
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@firingrange.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.warn('⚠️ Using default admin credentials admin@firingrange.com / admin123 for seed. Override via ADMIN_EMAIL / ADMIN_PASSWORD in production.');
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable.');
    process.exit(1);
  }

  try {
    const client = postgres(dbUrl);
    const db = drizzle(client);

    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists.');
      return;
    }

    const hashedPassword = await hashPassword(adminPassword);

    await db.insert(users).values({
      name: 'Administrador',
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
