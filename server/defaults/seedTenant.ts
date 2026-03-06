import { eq, and } from 'drizzle-orm';
import { emailTemplates, emailTriggers, emailTriggerTemplates } from '../../drizzle/schema';
import { defaultEmailTemplates } from './defaultTemplates';
import { defaultEmailTriggers } from './defaultTriggers';

export async function seedTenantEmailTemplates(tenantDb: any, tenantId: number) {
  console.log(`[Seed] Starting email templates seed for tenant ${tenantId}`);

  // Check if templates already exist for this tenant
  const existing = await tenantDb
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(eq(emailTemplates.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Seed] Tenant ${tenantId} already has ${existing.length}+ templates, skipping seed`);
    return { skipped: true, reason: 'templates_exist' };
  }

  // 1. Insert Templates
  const templateIdMap = new Map<string, number>();
  for (const t of defaultEmailTemplates) {
    try {
      const [inserted] = await tenantDb
        .insert(emailTemplates)
        .values({ ...t, tenantId })
        .returning({ id: emailTemplates.id });
      templateIdMap.set(t.templateKey, inserted.id);
    } catch (err: any) {
      console.warn(`[Seed] Template ${t.templateKey} insert failed (may already exist):`, err?.message);
    }
  }

  console.log(`[Seed] Inserted ${templateIdMap.size} templates for tenant ${tenantId}`);

  // 2. Insert Triggers and Map to Templates
  let triggersInserted = 0;
  for (const trigger of defaultEmailTriggers) {
    try {
      const [insertedTrigger] = await tenantDb
        .insert(emailTriggers)
        .values({ ...trigger, tenantId })
        .returning({ id: emailTriggers.id });

      triggersInserted++;

      // Map trigger to template based on triggerEvent
      let templateKeyToMap: string | null = null;
      if (trigger.triggerEvent === 'CLIENT_CREATED') templateKeyToMap = 'welcome';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:1') templateKeyToMap = 'juntada_documentos';
      else if (trigger.triggerEvent === 'SCHEDULE_CREATED' && !trigger.sendBeforeHours) templateKeyToMap = 'laudo_tecnico';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:2') templateKeyToMap = 'psicotecnico';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:3') templateKeyToMap = 'psicotecnico_concluido';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:4') templateKeyToMap = 'laudo_tecnico_concluido';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:5') templateKeyToMap = 'sinarm_montagem_iniciada';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:6') templateKeyToMap = 'sinarm_protocolado';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:7') templateKeyToMap = 'sinarm_aguardando_gru';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:8') templateKeyToMap = 'sinarm_em_analise';
      else if (trigger.triggerEvent === 'STEP_COMPLETED:9') templateKeyToMap = 'sinarm_restituido';

      if (templateKeyToMap && templateIdMap.has(templateKeyToMap)) {
        await tenantDb.insert(emailTriggerTemplates).values({
          triggerId: insertedTrigger.id,
          templateId: templateIdMap.get(templateKeyToMap)!,
          sendOrder: 1,
          isForReminder: trigger.sendBeforeHours ? true : false
        });
      }
    } catch (err: any) {
      console.warn(`[Seed] Trigger ${trigger.name} insert failed:`, err?.message);
    }
  }

  console.log(`[Seed] Inserted ${triggersInserted} triggers for tenant ${tenantId}`);
  return { skipped: false, templates: templateIdMap.size, triggers: triggersInserted };
}
