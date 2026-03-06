import { drizzle } from 'drizzle-orm/postgres-js';
import { emailTemplates, emailTriggers, emailTriggerTemplates } from '../../drizzle/schema';
import { defaultEmailTemplates } from './defaultTemplates';
import { defaultEmailTriggers } from './defaultTriggers';

export async function seedTenantEmailTemplates(tenantDb: any, tenantId: number) {
  console.log('Seeding email templates for tenant', tenantId);

  // 1. Insert Templates
  const templateIdMap = new Map<string, number>();
  for (const t of defaultEmailTemplates) {
    const [inserted] = await tenantDb
      .insert(emailTemplates)
      .values({ ...t, tenantId })
      .returning({ id: emailTemplates.id });
    templateIdMap.set(t.templateKey, inserted.id);
  }

  // 2. Insert Triggers and Map to Templates
  for (const trigger of defaultEmailTriggers) {
    const [insertedTrigger] = await tenantDb
      .insert(emailTriggers)
      .values({ ...trigger, tenantId })
      .returning({ id: emailTriggers.id });

    // Map trigger to template based on triggerEvent (simplified logic)
    let templateKeyToMap: string | null = null;
    if (trigger.triggerEvent === 'CLIENT_CREATED') templateKeyToMap = 'boasvindas-filiado';
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
  }
}
