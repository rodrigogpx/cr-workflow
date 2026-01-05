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
  const tenantSlug = process.env.TENANT_SLUG || 'dashboard';
  const tenantName = process.env.TENANT_NAME || 'Dashboard';
  const tenantDbHost = process.env.TENANT_DB_HOST || process.env.POSTGRES_HOST || 'postgres';
  const tenantDbPort = parseInt(process.env.TENANT_DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
  const tenantDbName = process.env.TENANT_DB_NAME || process.env.POSTGRES_DB || 'cac360';
  const tenantDbUser = process.env.TENANT_DB_USER || process.env.POSTGRES_USER || 'cac360';
  const tenantDbPassword = process.env.TENANT_DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'change_this_password';

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
    const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug));
    if (existingTenant.length > 0) {
      await db
        .update(tenants)
        .set({
          name: tenantName,
          dbHost: tenantDbHost,
          dbPort: tenantDbPort,
          dbName: tenantDbName,
          dbUser: tenantDbUser,
          dbPassword: tenantDbPassword,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(tenants.slug, tenantSlug));
      console.log(`✅ Tenant ${tenantSlug} atualizado/ativo.`);
    } else {
      await db.insert(tenants).values({
        slug: tenantSlug,
        name: tenantName,
        dbHost: tenantDbHost,
        dbPort: tenantDbPort,
        dbName: tenantDbName,
        dbUser: tenantDbUser,
        dbPassword: tenantDbPassword,
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

      console.log(`✅ Tenant ${tenantSlug} created/activated successfully.`);
    }

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

main().finally(() => {
  process.exit(0);
});
