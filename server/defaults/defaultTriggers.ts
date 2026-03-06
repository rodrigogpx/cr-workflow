import { InsertEmailTrigger } from '../../drizzle/schema';

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
    triggerEvent: 'STEP_COMPLETED:1',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Agendamento Laudo Técnico',
    triggerEvent: 'SCHEDULE_CREATED',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Lembrete Agendamento Laudo Técnico',
    triggerEvent: 'SCHEDULE_CREATED',
    recipientType: 'client',
    sendImmediate: false,
    sendBeforeHours: 24,
    isActive: true
  },
  {
    name: 'Encaminhamento Psicotécnico',
    triggerEvent: 'STEP_COMPLETED:2',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Avaliação Psicológica Concluída',
    triggerEvent: 'STEP_COMPLETED:3',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Laudo Técnico Concluído',
    triggerEvent: 'STEP_COMPLETED:4',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Montagem do Processo Iniciada',
    triggerEvent: 'STEP_COMPLETED:5',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo Protocolado',
    triggerEvent: 'STEP_COMPLETED:6',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Aguardando Baixa GRU',
    triggerEvent: 'STEP_COMPLETED:7',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo em Análise',
    triggerEvent: 'STEP_COMPLETED:8',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo Restituído',
    triggerEvent: 'STEP_COMPLETED:9',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  }
];
