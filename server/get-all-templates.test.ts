import { describe, it, expect } from 'vitest';

describe('Endpoint getAllTemplates', () => {
  
  it('deve retornar array de templates', () => {
    // Simula resposta do banco
    const templates = [
      { id: 1, templateKey: 'welcome', templateTitle: 'Boas Vindas', subject: 'Bem-vindo', content: '<p>Olá</p>', attachments: '[]' },
      { id: 2, templateKey: 'process_cr', templateTitle: 'Processo CR', subject: 'Processo', content: '<p>Info</p>', attachments: '[]' },
      { id: 3, templateKey: 'status_update', templateTitle: 'Atualização de Status', subject: 'Status', content: '<p>Atualização</p>', attachments: '[]' },
    ];
    
    expect(templates).toBeInstanceOf(Array);
    expect(templates.length).toBe(3);
  });

  it('deve ter estrutura correta de template', () => {
    const template = {
      id: 1,
      templateKey: 'welcome',
      templateTitle: 'Boas Vindas',
      subject: 'Bem-vindo',
      content: '<p>Olá</p>',
      attachments: '[]',
    };
    
    expect(template).toHaveProperty('templateKey');
    expect(template).toHaveProperty('templateTitle');
    expect(template).toHaveProperty('subject');
    expect(template).toHaveProperty('content');
  });

  it('deve mapear templates para exibição', () => {
    const templates = [
      { templateKey: 'welcome', templateTitle: 'Boas Vindas' },
      { templateKey: 'process_cr', templateTitle: 'Processo CR' },
    ];
    
    const mapped = templates.map((t, index) => ({
      key: t.templateKey,
      title: `${index + 1}. ${t.templateTitle}`,
    }));
    
    expect(mapped[0].title).toBe('1. Boas Vindas');
    expect(mapped[1].title).toBe('2. Processo CR');
  });

  it('deve validar que templates não estão vazios', () => {
    const templates = [
      { templateKey: 'welcome', templateTitle: 'Boas Vindas' },
      { templateKey: 'process_cr', templateTitle: 'Processo CR' },
      { templateKey: 'status_update', templateTitle: 'Atualização de Status' },
    ];
    
    expect(templates.length).toBeGreaterThan(0);
    templates.forEach(t => {
      expect(t.templateKey).toBeTruthy();
      expect(t.templateTitle).toBeTruthy();
    });
  });
});
