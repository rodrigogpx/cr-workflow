import { defaultEmailTemplates as rawTemplates } from './emailTemplatesData';

export const defaultEmailTemplates = rawTemplates.map(t => {
  let subject = '';
  let title = t.title;
  switch(t.templateKey) {
    case 'boasvindas-filiado': subject = 'Bem-vindo(a) à {{nome_clube}} - {{nome}}'; title = 'Boas Vindas (Automático)'; break;
    case 'process_cr': subject = 'Informações sobre o Processo CR - {{nome}}'; title = 'Processo CR'; break;
    case 'psicotecnico': subject = 'Encaminhamento para Avaliação Psicológica - {{nome}}'; title = 'Encaminhamento Psicotécnico'; break;
    case 'laudo_tecnico': subject = 'Agendamento de Laudo de Capacidade Técnica - {{nome}}'; title = 'Agendamento Laudo Técnico'; break;
    case 'juntada_documentos': subject = 'Conclusão da Juntada de Documentos - {{nome}}'; title = 'Juntada de Documentos'; break;
    case 'psicotecnico_concluido': subject = 'Sua Avaliação Psicológica foi recebida - {{nome}}'; title = 'Avaliação Psicológica Concluída'; break;
    case 'laudo_tecnico_concluido': subject = 'Seu Laudo Técnico foi recebido - {{nome}}'; title = 'Laudo Técnico Concluído'; break;
    case 'sinarm_montagem_iniciada': subject = 'Montagem do Processo Iniciada - {{nome}}'; title = 'Status Sinarm: Montagem Iniciada'; break;
    case 'sinarm_protocolado': subject = 'Seu Processo foi Protocolado - {{nome}}'; title = 'Status Sinarm: Processo Protocolado'; break;
    case 'sinarm_aguardando_gru': subject = 'Aguardando Baixa do Pagamento (GRU) - {{nome}}'; title = 'Status Sinarm: Aguardando Baixa GRU'; break;
    case 'sinarm_em_analise': subject = 'Seu Processo está em Análise - {{nome}}'; title = 'Status Sinarm: Em Análise'; break;
    case 'sinarm_restituido': subject = 'Ação Necessária: Processo Restituído - {{nome}}'; title = 'Status Sinarm: Processo Restituído'; break;
  }
  return {
    templateKey: t.templateKey,
    templateTitle: title,
    subject,
    content: Buffer.from(t.contentB64, 'base64').toString('utf8'),
    attachments: '[]',
    module: 'workflow-cr'
  };
});
