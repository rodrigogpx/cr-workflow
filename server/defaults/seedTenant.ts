import { eq, and } from 'drizzle-orm';
import { emailTemplates, emailTriggers, emailTriggerTemplates } from '../../drizzle/schema';
import { defaultEmailTemplates } from './defaultTemplates';
import { defaultEmailTriggers } from './defaultTriggers';

export async function seedTenantEmailTemplates(tenantDb: any, tenantId: number) {
  // 1. Insert Templates (idempotent by key)
  const templateIdMap = new Map<string, number>();
  let templatesInserted = 0;

  for (const t of defaultEmailTemplates) {
    try {
      // Check if this specific template already exists for this tenant
      const existingTemplate = await tenantDb
        .select({ id: emailTemplates.id })
        .from(emailTemplates)
        .where(and(
          eq(emailTemplates.tenantId, tenantId),
          eq(emailTemplates.templateKey, t.templateKey)
        ))
        .limit(1);

      if (existingTemplate.length > 0) {
        templateIdMap.set(t.templateKey, existingTemplate[0].id);
        continue;
      }

      const [inserted] = await tenantDb
        .insert(emailTemplates)
        .values({ ...t, tenantId })
        .returning({ id: emailTemplates.id });
      
      templateIdMap.set(t.templateKey, inserted.id);
      templatesInserted++;
    } catch (err: any) {
      console.warn(`[Seed] Template ${t.templateKey} insert failed:`, err?.message);
    }
  }

  // 2. Insert Triggers and Map to Templates (idempotent by name + event)
  let triggersInserted = 0;
  for (const trigger of defaultEmailTriggers) {
    try {
      // Check if this trigger already exists
      const existingTrigger = await tenantDb
        .select({ id: emailTriggers.id })
        .from(emailTriggers)
        .where(and(
          eq(emailTriggers.tenantId, tenantId),
          eq(emailTriggers.name, trigger.name),
          eq(emailTriggers.triggerEvent, trigger.triggerEvent)
        ))
        .limit(1);

      let triggerId: number;
      if (existingTrigger.length > 0) {
        triggerId = existingTrigger[0].id;
      } else {
        const [insertedTrigger] = await tenantDb
          .insert(emailTriggers)
          .values({ ...trigger, tenantId })
          .returning({ id: emailTriggers.id });
        triggerId = insertedTrigger.id;
        triggersInserted++;
      }

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
        const templateId = templateIdMap.get(templateKeyToMap)!;
        
        // Check if association already exists
        const existingAssoc = await tenantDb
          .select()
          .from(emailTriggerTemplates)
          .where(and(
            eq(emailTriggerTemplates.triggerId, triggerId),
            eq(emailTriggerTemplates.templateId, templateId)
          ))
          .limit(1);

        if (existingAssoc.length === 0) {
          await tenantDb.insert(emailTriggerTemplates).values({
            triggerId,
            templateId,
            sendOrder: 1,
            isForReminder: trigger.sendBeforeHours ? true : false
          });
        }
      }
    } catch (err: any) {
      console.warn(`[Seed] Trigger ${trigger.name} insert failed:`, err?.message);
    }
  }

  return { skipped: templatesInserted === 0 && triggersInserted === 0, templates: templatesInserted, triggers: triggersInserted };
}
