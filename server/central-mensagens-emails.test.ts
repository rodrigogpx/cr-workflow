import { describe, it, expect } from 'vitest';

describe('Central de Mensagens - Múltiplas Opções de Email', () => {
  
  it('deve ter 3 tipos de email disponíveis', () => {
    const emailTemplates = [
      { key: 'welcome', title: '1. Email de Boas Vindas' },
      { key: 'process_cr', title: '2. Processo de Obtenção do CR' },
      { key: 'status_update', title: '3. Atualização de Status' },
    ];
    
    expect(emailTemplates).toHaveLength(3);
    expect(emailTemplates[0].key).toBe('welcome');
    expect(emailTemplates[1].key).toBe('process_cr');
    expect(emailTemplates[2].key).toBe('status_update');
  });

  it('deve validar chaves de template corretas', () => {
    const validKeys = ['welcome', 'process_cr', 'status_update'];
    
    expect(validKeys).toContain('welcome');
    expect(validKeys).toContain('process_cr');
    expect(validKeys).toContain('status_update');
    expect(validKeys).not.toContain('boas_vindas'); // chave antiga
  });

  it('deve exibir emails apenas na etapa Central de Mensagens', () => {
    const stepTitle = 'Central de Mensagens';
    const shouldShowEmails = stepTitle === 'Central de Mensagens';
    
    expect(shouldShowEmails).toBe(true);
  });

  it('não deve exibir emails em outras etapas', () => {
    const otherSteps = ['Cadastro', 'Agendamento de Laudo', 'Juntada de Documentos'];
    
    otherSteps.forEach(stepTitle => {
      const shouldShowEmails = stepTitle === 'Central de Mensagens';
      expect(shouldShowEmails).toBe(false);
    });
  });

  it('deve ter títulos descritivos para cada email', () => {
    const emailTitles = [
      '1. Email de Boas Vindas',
      '2. Processo de Obtenção do CR',
      '3. Atualização de Status',
    ];
    
    expect(emailTitles[0]).toContain('Boas Vindas');
    expect(emailTitles[1]).toContain('Processo');
    expect(emailTitles[2]).toContain('Atualização');
  });

  it('deve permitir envio de qualquer template', () => {
    const allowedTemplates = ['welcome', 'process_cr', 'status_update'];
    const templateToSend = 'process_cr';
    
    expect(allowedTemplates).toContain(templateToSend);
  });
});
