import { eq, and } from 'drizzle-orm';
import { emailTemplates, emailTriggers, emailTriggerTemplates } from '../../drizzle/schema';
import { defaultEmailTemplates } from './defaultTemplates';
import { defaultEmailTriggers } from './defaultTriggers';

// Map trigger name → template key for correct associations
const TRIGGER_TEMPLATE_MAP: Record<string, string> = {
  'Boas Vindas': 'welcome',
  'Conclusão Juntada de Documentos': 'juntada_documentos',
  'Encaminhamento Psicotécnico': 'psicotecnico',
  'Avaliação Psicológica Concluída': 'psicotecnico_concluido',
  'Agendamento Laudo Técnico': 'laudo_tecnico',
  'Lembrete Agendamento Laudo Técnico': 'agendamento-laudo',
  'Laudo Técnico Concluído': 'laudo_tecnico_concluido',
  'Montagem do Processo Iniciada': 'sinarm_montagem_iniciada',
  'Processo Protocolado': 'sinarm_protocolado',
  'Aguardando Baixa GRU': 'sinarm_aguardando_gru',
  'Processo em Análise': 'sinarm_em_analise',
  'Processo Restituído': 'sinarm_restituido',
};

export async function seedTenantEmailTemplates(tenantDb: any, tenantId: number) {
  // 1. Upsert Templates (insert or update existing by key)
  const templateIdMap = new Map<string, number>();
  let templatesInserted = 0;

  for (const t of defaultEmailTemplates) {
    try {
      const existingTemplate = await tenantDb
        .select({ id: emailTemplates.id })
        .from(emailTemplates)
        .where(and(
          eq(emailTemplates.tenantId, tenantId),
          eq(emailTemplates.templateKey, t.templateKey)
        ))
        .limit(1);

      if (existingTemplate.length > 0) {
        // UPDATE existing template with corrected content/subject/title
        await tenantDb
          .update(emailTemplates)
          .set({
            content: t.content,
            subject: t.subject,
            templateTitle: t.templateTitle,
            module: t.module,
          })
          .where(eq(emailTemplates.id, existingTemplate[0].id));
        templateIdMap.set(t.templateKey, existingTemplate[0].id);
        templatesInserted++;
      } else {
        const [inserted] = await tenantDb
          .insert(emailTemplates)
          .values({ ...t, tenantId })
          .returning({ id: emailTemplates.id });
        templateIdMap.set(t.templateKey, inserted.id);
        templatesInserted++;
      }
    } catch (err: any) {
      console.warn(`[Seed] Template ${t.templateKey} upsert failed:`, err?.message);
    }
  }

  // 2. Upsert Triggers and Map to Templates
  let triggersInserted = 0;
  for (const trigger of defaultEmailTriggers) {
    try {
      // Check by name only (event may have changed)
      const existingTrigger = await tenantDb
        .select({ id: emailTriggers.id })
        .from(emailTriggers)
        .where(and(
          eq(emailTriggers.tenantId, tenantId),
          eq(emailTriggers.name, trigger.name)
        ))
        .limit(1);

      let triggerId: number;
      if (existingTrigger.length > 0) {
        // Update existing trigger with corrected event
        await tenantDb
          .update(emailTriggers)
          .set({
            triggerEvent: trigger.triggerEvent,
            recipientType: trigger.recipientType,
            sendImmediate: trigger.sendImmediate,
            sendBeforeHours: trigger.sendBeforeHours ?? null,
            isActive: trigger.isActive,
          })
          .where(eq(emailTriggers.id, existingTrigger[0].id));
        triggerId = existingTrigger[0].id;
        triggersInserted++;
      } else {
        const [insertedTrigger] = await tenantDb
          .insert(emailTriggers)
          .values({ ...trigger, tenantId })
          .returning({ id: emailTriggers.id });
        triggerId = insertedTrigger.id;
        triggersInserted++;
      }

      // Map trigger to template by name
      const templateKeyToMap = TRIGGER_TEMPLATE_MAP[trigger.name] || null;

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
      console.warn(`[Seed] Trigger ${trigger.name} upsert failed:`, err?.message);
    }
  }

  return { skipped: false, templates: templatesInserted, triggers: triggersInserted };
}
