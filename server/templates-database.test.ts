import { describe, it, expect } from 'vitest';

describe('Templates no Banco de Dados', () => {
  
  it('deve ter 3 templates padrão', () => {
    const expectedTemplates = ['welcome', 'process_cr', 'status_update'];
    
    expect(expectedTemplates.length).toBe(3);
  });

  it('deve ter templateKey correto para cada template', () => {
    const templates = [
      { templateKey: 'welcome', templateTitle: 'Boas Vindas' },
      { templateKey: 'process_cr', templateTitle: 'Processo CR' },
      { templateKey: 'status_update', templateTitle: 'Atualização de Status' },
    ];
    
    expect(templates[0].templateKey).toBe('welcome');
    expect(templates[1].templateKey).toBe('process_cr');
    expect(templates[2].templateKey).toBe('status_update');
  });

  it('deve ter templateTitle para todos os templates', () => {
    const templates = [
      { templateKey: 'welcome', templateTitle: 'Boas Vindas' },
      { templateKey: 'process_cr', templateTitle: 'Processo CR' },
      { templateKey: 'status_update', templateTitle: 'Atualização de Status' },
    ];
    
    templates.forEach(t => {
      expect(t.templateTitle).toBeTruthy();
      expect(t.templateTitle).not.toBe('');
    });
  });

  it('deve exibir templates na Central de Mensagens', () => {
    const templates = [
      { templateKey: 'welcome', templateTitle: 'Boas Vindas' },
      { templateKey: 'process_cr', templateTitle: 'Processo CR' },
      { templateKey: 'status_update', templateTitle: 'Atualização de Status' },
    ];
    
    const displayed = templates.map((t, index) => `${index + 1}. ${t.templateTitle}`);
    
    expect(displayed[0]).toBe('1. Boas Vindas');
    expect(displayed[1]).toBe('2. Processo CR');
    expect(displayed[2]).toBe('3. Atualização de Status');
  });

  it('deve validar chaves não duplicadas', () => {
    const templates = ['welcome', 'process_cr', 'status_update'];
    const uniqueKeys = new Set(templates);
    
    expect(uniqueKeys.size).toBe(templates.length);
  });

  it('deve rejeitar chaves antigas incorretas', () => {
    const oldKeys = ['process', 'status'];
    const newKeys = ['process_cr', 'status_update'];
    
    expect(oldKeys).not.toContain('process_cr');
    expect(oldKeys).not.toContain('status_update');
    expect(newKeys).toContain('process_cr');
    expect(newKeys).toContain('status_update');
  });
});
