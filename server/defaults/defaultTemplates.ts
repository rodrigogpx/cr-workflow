import { defaultEmailTemplates as rawTemplates } from "./emailTemplatesData";

/**
 * Fix double-encoded UTF-8 content.
 * The base64 HTML data was encoded as: original UTF-8 bytes → treated as Latin-1 → re-encoded to UTF-8.
 * Result: "ç" (C3 A7) became C3 83 C2 A7 → decodes as "ç" (mojibake).
 * Fix: decode as UTF-8 (gets mojibake chars), then take each char's code point as a byte (latin1),
 * then re-interpret those bytes as UTF-8.
 */
function fixDoubleUtf8(raw: string): string {
  try {
    const buf = Buffer.from(raw, "latin1");
    const fixed = buf.toString("utf8");
    // Sanity check: if the result still contains typical mojibake patterns, return raw
    if (fixed.includes("\uFFFD")) return raw;
    return fixed;
  } catch {
    return raw;
  }
}

export const defaultEmailTemplates = rawTemplates.map(t => {
  let subject = "";
  let title = t.title;
  switch (t.templateKey) {
    // ── Fluxo principal do processo CR ──────────────────────────────────────
    case "welcome":
      subject = "Bem-vindo(a) ao CAC 360, {{nome}}! Seu portal está pronto.";
      title = "Boas Vindas";
      break;
    case "cadastro_concluido":
      subject = "Seu cadastro foi concluído - {{nome}}";
      title = "Cadastro Concluído";
      break;
    case "juntada_documentos":
      subject = "Conclusão da Juntada de Documentos - {{nome}}";
      title = "Juntada de Documentos";
      break;
    case "psicotecnico":
      subject = "Encaminhamento para Avaliação Psicológica - {{nome}}";
      title = "Encaminhamento Psicotécnico";
      break;
    case "psicotecnico_concluido":
      subject = "Sua Avaliação Psicológica foi recebida - {{nome}}";
      title = "Avaliação Psicológica Concluída";
      break;
    case "laudo_tecnico":
      subject = "Agendamento de Laudo de Capacidade Técnica - {{nome}}";
      title = "Agendamento Laudo Técnico";
      break;
    case "laudo_tecnico_concluido":
      subject = "Seu Laudo Técnico foi recebido - {{nome}}";
      title = "Laudo Técnico Concluído";
      break;
    // ── Status Sinarm ────────────────────────────────────────────────────────
    case "sinarm_iniciado":
      subject = "Montagem do Processo CAC Iniciada - {{nome}}";
      title = "Status Sinarm: Processo Iniciado";
      break;
    case "sinarm_solicitado":
      subject = "Seu Processo CAC foi Solicitado no Sinarm - {{nome}}";
      title = "Status Sinarm: Processo Solicitado";
      break;
    case "sinarm_em_analise":
      subject = "Seu Processo CAC está em Análise - {{nome}}";
      title = "Status Sinarm: Em Análise";
      break;
    case "sinarm_aguardando_gru":
      subject = "Aguardando Baixa do Pagamento (GRU) - {{nome}}";
      title = "Status Sinarm: Aguardando Baixa GRU";
      break;
    case "sinarm_restituido":
      subject = "Ação Necessária: Processo CAC Restituído - {{nome}}";
      title = "Status Sinarm: Processo Restituído";
      break;
    case "sinarm_deferido":
      subject = "Parabéns! Seu CR foi Aprovado - {{nome}}";
      title = "Status Sinarm: CR Aprovado";
      break;
    case "sinarm_indeferido":
      subject = "Resultado do seu Processo CAC - {{nome}}";
      title = "Status Sinarm: Processo Indeferido";
      break;
    case "psicotecnico_agendado":
      subject = "Agendamento Psicológico Confirmado - {{nome}}";
      title = "Agendamento Avaliação Psicológica";
      break;
  }
  const rawContent = Buffer.from(t.contentB64, "base64").toString("utf8");
  return {
    templateKey: t.templateKey,
    templateTitle: title,
    subject,
    content: fixDoubleUtf8(rawContent),
    attachments: "[]",
    module: "workflow-cr",
  };
});
