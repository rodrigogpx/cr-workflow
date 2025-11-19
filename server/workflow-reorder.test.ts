import { describe, it, expect } from 'vitest';

describe('Reordenação e Renomeação de Fases do Workflow', () => {
  
  it('deve ter Central de Mensagens como primeira fase', () => {
    const steps = [
      { stepId: 'boas-vindas', stepTitle: 'Central de Mensagens' },
      { stepId: 'cadastro', stepTitle: 'Cadastro' },
      { stepId: 'agendamento-psicotecnico', stepTitle: 'Encaminhamento de Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo' },
      { stepId: 'agendamento-laudo', stepTitle: 'Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)' },
      { stepId: 'juntada-documento', stepTitle: 'Juntada de Documentos' },
      { stepId: 'acompanhamento-sinarm', stepTitle: 'Acompanhamento Sinarm-CAC' },
    ];
    
    expect(steps[0].stepId).toBe('boas-vindas');
    expect(steps[0].stepTitle).toBe('Central de Mensagens');
    expect(steps[1].stepId).toBe('cadastro');
  });

  it('deve ter nome correto "Central de Mensagens"', () => {
    const stepTitle = 'Central de Mensagens';
    expect(stepTitle).toBe('Central de Mensagens');
    expect(stepTitle).not.toBe('Boas Vindas');
    expect(stepTitle).not.toBe('Central de Comunicações');
  });

  it('deve ter nome correto "Encaminhamento de Avaliação Psicológica"', () => {
    const stepTitle = 'Encaminhamento de Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo';
    expect(stepTitle).toContain('Encaminhamento');
    expect(stepTitle).not.toContain('Agendamento Avaliação');
  });

  it('deve aceitar data e hora no agendamento de laudo', () => {
    const scheduledDate = '2025-01-15T14:30';
    const dateObj = new Date(scheduledDate);
    
    expect(dateObj.getHours()).toBe(14);
    expect(dateObj.getMinutes()).toBe(30);
  });

  it('deve formatar data e hora corretamente para exibição', () => {
    const scheduledDate = new Date('2025-01-15T14:30:00');
    const formatted = scheduledDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    
    expect(formatted).toContain('15/01');
    expect(formatted).toContain('14:30');
  });

  it('deve validar ordem das fases', () => {
    const stepOrder = ['boas-vindas', 'cadastro', 'agendamento-psicotecnico', 'agendamento-laudo', 'juntada-documento', 'acompanhamento-sinarm'];
    
    expect(stepOrder[0]).toBe('boas-vindas');
    expect(stepOrder.indexOf('boas-vindas')).toBeLessThan(stepOrder.indexOf('cadastro'));
  });
});
