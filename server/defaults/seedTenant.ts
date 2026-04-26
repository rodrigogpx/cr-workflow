import { eq, and, isNull } from "drizzle-orm";
import {
  emailTemplates,
  emailTriggers,
  emailTriggerTemplates,
} from "../../drizzle/schema";
import { defaultEmailTemplates as staticDefaultTemplates } from "./defaultTemplates";
import { defaultEmailTriggers } from "./defaultTriggers";

// ─── Normalização de chaves (DB → padrão do seed) ───────────────────────────
// Aplicada aos templates com tenantId = NULL quando carregados do banco em runtime.
// Permite que os templates sejam editados diretamente no banco sem re-deploy.
const KEY_MAP: Record<string, string> = {
  boas_vindas_clube: "welcome",
  juntada_documentos: "juntada_documentos", // já igual
  encaminhamento_psicologico: "psicotecnico",
  avaliacao_psicologica: "psicotecnico_concluido",
  agendamento_laudo: "laudo_tecnico",
  confirmacao_laudo: "laudo_tecnico_concluido",
  "cadastro-concluido": "cadastro_concluido",
  "sinarm_cac_status-solicitado": "sinarm_solicitado",
  "sinarm_cac_status-iniciado": "sinarm_iniciado",
  "sinarm_cac_status-analise": "sinarm_em_analise",
  "sinarm_cac_status-gru": "sinarm_aguardando_gru",
  "sinarm_cac_status-restituido": "sinarm_restituido",
};

// Subjects e títulos padrão por chave normalizada.
// Usados quando o template do banco não tem subject/title definido.
const META: Record<string, { title: string; subject: string }> = {
  welcome: {
    title: "Boas Vindas",
    subject: "Bem-vindo(a) ao CAC 360, {{nome}}! Seu portal está pronto.",
  },
  cadastro_concluido: {
    title: "Cadastro Concluído",
    subject: "Seu cadastro foi concluído - {{nome}}",
  },
  juntada_documentos: {
    title: "Juntada de Documentos",
    subject: "Conclusão da Juntada de Documentos - {{nome}}",
  },
  psicotecnico: {
    title: "Encaminhamento Psicotécnico",
    subject: "Encaminhamento para Avaliação Psicológica - {{nome}}",
  },
  psicotecnico_concluido: {
    title: "Avaliação Psicológica Concluída",
    subject: "Sua Avaliação Psicológica foi recebida - {{nome}}",
  },
  laudo_tecnico: {
    title: "Agendamento Laudo Técnico",
    subject: "Agendamento de Laudo de Capacidade Técnica - {{nome}}",
  },
  laudo_tecnico_concluido: {
    title: "Laudo Técnico Concluído",
    subject: "Seu Laudo Técnico foi recebido - {{nome}}",
  },
  sinarm_iniciado: {
    title: "Status Sinarm: Processo Iniciado",
    subject: "Montagem do Processo CAC Iniciada - {{nome}}",
  },
  sinarm_solicitado: {
    title: "Status Sinarm: Processo Solicitado",
    subject: "Seu Processo CAC foi Solicitado no Sinarm - {{nome}}",
  },
  sinarm_em_analise: {
    title: "Status Sinarm: Em Análise",
    subject: "Seu Processo CAC está em Análise - {{nome}}",
  },
  sinarm_aguardando_gru: {
    title: "Status Sinarm: Aguardando Baixa GRU",
    subject: "Aguardando Baixa do Pagamento (GRU) - {{nome}}",
  },
  sinarm_restituido: {
    title: "Status Sinarm: Processo Restituído",
    subject: "Ação Necessária: Processo CAC Restituído - {{nome}}",
  },
  sinarm_deferido: {
    title: "Status Sinarm: CR Aprovado",
    subject: "Parabéns! Seu CR foi Aprovado - {{nome}}",
  },
  sinarm_indeferido: {
    title: "Status Sinarm: Processo Indeferido",
    subject: "Resultado do seu Processo CAC - {{nome}}",
  },
  psicotecnico_agendado: {
    title: "Agendamento Avaliação Psicológica",
    subject: "Agendamento Psicológico Confirmado - {{nome}}",
  },
};

// ─── Mapa trigger name → template key ───────────────────────────────────────
// As chaves correspondem exatamente às templateKey normalizadas acima.
const TRIGGER_TEMPLATE_MAP: Record<string, string> = {
  "Boas Vindas": "welcome",
  "Cadastro Concluído": "cadastro_concluido",
  "Encaminhamento Psicotécnico": "psicotecnico", // STEP_COMPLETED:2 (agendamento-psicotecnico)
  "Laudo de Capacidade Técnica Concluído": "laudo_tecnico_concluido", // STEP_COMPLETED:3 (agendamento-laudo)
  "Conclusão Juntada de Documentos": "juntada_documentos", // STEP_COMPLETED:4 (juntada-documento)
  "Processo Enviado ao SINARM": "sinarm_iniciado", // STEP_COMPLETED:5 (acompanhamento-sinarm)
  "Agendamento Laudo Técnico": "laudo_tecnico", // SCHEDULE_TECH_CONFIRMATION
  "Lembrete Agendamento Laudo Técnico": "laudo_tecnico", // SCHEDULE_TECH_CONFIRMATION (sendBeforeHours:24)
  "Agendamento Avaliação Psicológica": "psicotecnico_agendado", // SCHEDULE_PSYCH_CREATED
  "Processo Iniciado no Sinarm": "sinarm_iniciado",
  "Processo Solicitado no Sinarm": "sinarm_solicitado",
  "Aguardando Baixa GRU": "sinarm_aguardando_gru",
  "Processo em Análise": "sinarm_em_analise",
  "Processo Restituído": "sinarm_restituido",
  "Processo Indeferido": "sinarm_indeferido",
  "Processo Deferido": "sinarm_deferido",
  // OBS: legacy names foram removidos — a correção definitiva do link trigger→template
  // é feita por triggerEvent em ensure-tables.ts (migration). Mapear por nome antigo
  // pode linkar ao template errado quando o triggerEvent histórico diferiu.
};

/**
 * Carrega os templates de seed com prioridade:
 *   1. Templates com tenantId = NULL do banco (editáveis sem re-deploy)
 *   2. Fallback: arquivos TypeScript estáticos compilados
 */
async function loadSeedTemplates(tenantDb: any): Promise<
  Array<{
    templateKey: string;
    templateTitle: string;
    subject: string;
    content: string;
    attachments: string;
    module: string;
  }>
> {
  try {
    const nullTemplates = await tenantDb
      .select({
        templateKey: emailTemplates.templateKey,
        templateTitle: emailTemplates.templateTitle,
        subject: emailTemplates.subject,
        content: emailTemplates.content,
      })
      .from(emailTemplates)
      .where(isNull(emailTemplates.tenantId));

    if (nullTemplates.length > 0) {
      console.log(
        `[Seed] Usando ${nullTemplates.length} templates do banco (tenantId = NULL) como fonte de seed.`
      );
      return nullTemplates.map((t: any) => {
        const newKey = KEY_MAP[t.templateKey] ?? t.templateKey;
        const meta = META[newKey] ?? {
          title: t.templateTitle || newKey,
          subject: t.subject || "",
        };
        return {
          templateKey: newKey,
          templateTitle: t.templateTitle || meta.title,
          subject: t.subject || meta.subject,
          content: t.content || "",
          attachments: "[]",
          module: "workflow-cr",
        };
      });
    }
  } catch (err: any) {
    console.warn(
      "[Seed] Não foi possível carregar templates null-tenant do banco, usando fallback estático:",
      err?.message
    );
  }

  console.log(
    `[Seed] Usando ${staticDefaultTemplates.length} templates estáticos compilados como fonte de seed.`
  );
  return staticDefaultTemplates;
}

export async function seedTenantEmailTemplates(
  tenantDb: any,
  tenantId: number
) {
  // ── 1. Carregar fonte de templates (banco ou estático) ──────────────────
  const seedTemplates = await loadSeedTemplates(tenantDb);

  // ── 2. Upsert Templates ─────────────────────────────────────────────────
  const templateIdMap = new Map<string, number>();
  let templatesInserted = 0;

  for (const t of seedTemplates) {
    try {
      const existingTemplate = await tenantDb
        .select({ id: emailTemplates.id })
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.tenantId, tenantId),
            eq(emailTemplates.templateKey, t.templateKey)
          )
        )
        .limit(1);

      if (existingTemplate.length > 0) {
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
      console.warn(
        `[Seed] Template ${t.templateKey} upsert failed:`,
        err?.message
      );
    }
  }

  // ── 3. Upsert Triggers e associações ────────────────────────────────────
  let triggersInserted = 0;
  for (const trigger of defaultEmailTriggers) {
    try {
      const existingTrigger = await tenantDb
        .select({ id: emailTriggers.id })
        .from(emailTriggers)
        .where(
          and(
            eq(emailTriggers.tenantId, tenantId),
            eq(emailTriggers.name, trigger.name)
          )
        )
        .limit(1);

      let triggerId: number;
      if (existingTrigger.length > 0) {
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

      const templateKeyToMap = TRIGGER_TEMPLATE_MAP[trigger.name] || null;

      if (templateKeyToMap && templateIdMap.has(templateKeyToMap)) {
        const templateId = templateIdMap.get(templateKeyToMap)!;

        // Verificar se já existe associação com o template CORRETO
        const existingCorrectAssoc = await tenantDb
          .select()
          .from(emailTriggerTemplates)
          .where(
            and(
              eq(emailTriggerTemplates.triggerId, triggerId),
              eq(emailTriggerTemplates.templateId, templateId)
            )
          )
          .limit(1);

        if (existingCorrectAssoc.length === 0) {
          // Remover qualquer associação errada anterior para este trigger
          // (garante que re-seed corrija associações incorretas, não apenas ausentes)
          await tenantDb
            .delete(emailTriggerTemplates)
            .where(eq(emailTriggerTemplates.triggerId, triggerId));

          await tenantDb.insert(emailTriggerTemplates).values({
            triggerId,
            templateId,
            sendOrder: 1,
            isForReminder: trigger.sendBeforeHours ? true : false,
          });
        }
      }
    } catch (err: any) {
      console.warn(
        `[Seed] Trigger ${trigger.name} upsert failed:`,
        err?.message
      );
    }
  }

  return {
    skipped: false,
    templates: templatesInserted,
    triggers: triggersInserted,
  };
}
