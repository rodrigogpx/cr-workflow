import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { users, tenants } from './schema';
import { hashPassword } from '../server/_core/auth';

async function main() {
  console.log('🌱 Seeding database...');

  // Permitir configuração via variáveis de ambiente, mas com defaults seguros para
  // ambiente de desenvolvimento/local. Em produção, sempre sobrescreva via env.
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@acrdigital.com.br';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin@';

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    console.warn('⚠️ Using default admin credentials admin@acrdigital.com.br / admin@ for seed. Override via ADMIN_EMAIL / ADMIN_PASSWORD in production.');
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable.');
    process.exit(1);
  }

  try {
    const client = postgres(dbUrl);
    const db = drizzle(client);

    // ============================================
    // SEED: Admin User
    // ============================================
    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists.');
    } else {
      const hashedPassword = await hashPassword(adminPassword);

      await db.insert(users).values({
        name: 'Administrador',
        email: adminEmail,
        hashedPassword: hashedPassword,
        role: 'admin',
        perfil: 'admin',
      });

      console.log('✅ Admin user created successfully.');
    }

    // ============================================
    // SEED: Default Tenant (Multi-Tenant)
    // ============================================
    const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, 'default'));
    if (existingTenant.length > 0) {
      console.log('✅ Default tenant already exists.');
    } else {
      await db.insert(tenants).values({
        slug: 'default',
        name: 'CAC 360 - Demo',
        dbHost: process.env.DB_HOST || 'localhost',
        dbPort: parseInt(process.env.DB_PORT || '5432'),
        dbName: process.env.DB_NAME || 'cac360_default',
        dbUser: process.env.DB_USER || 'cac360_user',
        dbPassword: process.env.DB_PASSWORD || 'change_this_password',
        primaryColor: '#1a5c00',
        secondaryColor: '#4d9702',
        featureWorkflowCR: true,
        featureApostilamento: false,
        featureRenovacao: false,
        featureInsumos: false,
        plan: 'enterprise',
        subscriptionStatus: 'active',
        maxUsers: 100,
        maxClients: 10000,
        maxStorageGB: 500,
        isActive: true,
      });

      console.log('✅ Default tenant created successfully.');
    }

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

main().finally(() => {
  process.exit(0);
});
