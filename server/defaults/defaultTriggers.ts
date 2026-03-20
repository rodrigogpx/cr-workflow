import { InsertEmailTrigger } from '../../drizzle/schema';

// Workflow steps → stepIdToNumber mapping (routers.ts):
//   1 = cadastro
//   2 = juntada-documento
//   3 = boas-vindas (Central de Mensagens)
//   4 = agendamento-psicotecnico
//   5 = agendamento-laudo
//   6 = acompanhamento-sinarm
//
// Sinarm statuses (ClientWorkflow.tsx):
//   Iniciado, Solicitado, Aguardando Baixa GRU, Em Análise,
//   Restituído (→ event Correção Solicitada), Deferido, Indeferido
//
// Schedule events (routers.ts):
//   SCHEDULE_PSYCH_CREATED, SCHEDULE_TECH_CONFIRMATION

export const defaultEmailTriggers: Omit<InsertEmailTrigger, 'tenantId'>[] = [
  {
    name: 'Boas Vindas',
    triggerEvent: 'CLIENT_CREATED',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Conclusão Juntada de Documentos',
    triggerEvent: 'STEP_COMPLETED:2',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Encaminhamento Psicotécnico',
    triggerEvent: 'STEP_COMPLETED:3',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Avaliação Psicológica Concluída',
    triggerEvent: 'STEP_COMPLETED:4',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Agendamento Laudo Técnico',
    triggerEvent: 'SCHEDULE_TECH_CONFIRMATION',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Lembrete Agendamento Laudo Técnico',
    triggerEvent: 'SCHEDULE_TECH_CONFIRMATION',
    recipientType: 'client',
    sendImmediate: false,
    sendBeforeHours: 24,
    isActive: true
  },
  {
    name: 'Laudo Técnico Concluído',
    triggerEvent: 'STEP_COMPLETED:5',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo Solicitado no Sinarm',
    triggerEvent: 'SINARM_STATUS:Solicitado',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo Deferido',
    triggerEvent: 'SINARM_STATUS:Deferido',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Aguardando Baixa GRU',
    triggerEvent: 'SINARM_STATUS:Aguardando Baixa GRU',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo em Análise',
    triggerEvent: 'SINARM_STATUS:Em Análise',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo Restituído',
    triggerEvent: 'SINARM_STATUS:Correção Solicitada',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo Indeferido',
    triggerEvent: 'SINARM_STATUS:Indeferido',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  }
];
