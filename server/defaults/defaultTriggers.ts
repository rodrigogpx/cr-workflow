import { InsertEmailTrigger } from '../../drizzle/schema';

// Workflow step order (from getAvailableEvents):
//   1 = Cadastro
//   2 = Juntada de Documentos
//   3 = Central de Mensagens
//   4 = Avaliação Psicológica
//   5 = Laudo Técnico
//   6 = Acompanhamento Sinarm
//   7 = Montagem Sinarm
//   8 = Protocolado
//   9 = Concluído

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
    name: 'Laudo Técnico Concluído',
    triggerEvent: 'STEP_COMPLETED:5',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Montagem do Processo Iniciada',
    triggerEvent: 'STEP_COMPLETED:7',
    recipientType: 'client',
    sendImmediate: true,
    isActive: true
  },
  {
    name: 'Processo Protocolado',
    triggerEvent: 'STEP_COMPLETED:8',
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
  }
];
