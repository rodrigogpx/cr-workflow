import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Formulário de Agendamento de Laudo', () => {
  
  it('deve ter stepId agendamento-laudo configurado', () => {
    const routersPath = resolve(__dirname, './routers.ts');
    const routersContent = readFileSync(routersPath, 'utf-8');
    
    expect(routersContent).toContain("stepId: 'agendamento-laudo'");
    expect(routersContent).toContain("stepTitle: 'Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)'");
  });
  
  it('deve renderizar formulário quando stepId é agendamento-laudo', () => {
    const clientWorkflowPath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
    const clientWorkflowContent = readFileSync(clientWorkflowPath, 'utf-8');
    
    // Verifica se a condição de renderização inclui stepId agendamento-laudo
    expect(clientWorkflowContent).toContain('step.stepId === "agendamento-laudo"');
  });
  
  it('deve ter input de data e hora (datetime-local)', () => {
    const clientWorkflowPath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
    const clientWorkflowContent = readFileSync(clientWorkflowPath, 'utf-8');
    
    expect(clientWorkflowContent).toContain('type="datetime-local"');
    expect(clientWorkflowContent).toContain('Data e Hora do Agendamento');
  });
  
  it('deve ter input de nome do examinador', () => {
    const clientWorkflowPath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
    const clientWorkflowContent = readFileSync(clientWorkflowPath, 'utf-8');
    
    expect(clientWorkflowContent).toContain('Nome do Examinador');
    expect(clientWorkflowContent).toContain('Digite o nome do examinador');
  });
  
  it('deve ter botão de salvar agendamento', () => {
    const clientWorkflowPath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
    const clientWorkflowContent = readFileSync(clientWorkflowPath, 'utf-8');
    
    expect(clientWorkflowContent).toContain('Salvar Agendamento');
  });
  
  it('deve mostrar formulário quando etapa NÃO está concluída', () => {
    const clientWorkflowPath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
    const clientWorkflowContent = readFileSync(clientWorkflowPath, 'utf-8');
    
    // Formulário deve aparecer quando scheduledDate é null/undefined
    expect(clientWorkflowContent).toMatch(/step\.scheduledDate\s*\?/);
  });
  
  it('deve mostrar informações de agendamento quando etapa está concluída', () => {
    const clientWorkflowPath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
    const clientWorkflowContent = readFileSync(clientWorkflowPath, 'utf-8');
    
    // Informações devem aparecer quando scheduledDate existe
    expect(clientWorkflowContent).toContain('Informações de Agendamento');
  });
  
  it('deve ter mutation para salvar agendamento', () => {
    const clientWorkflowPath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
    const clientWorkflowContent = readFileSync(clientWorkflowPath, 'utf-8');
    
    expect(clientWorkflowContent).toContain('updateSchedulingMutation');
    expect(clientWorkflowContent).toContain('scheduledDate');
    expect(clientWorkflowContent).toContain('examinerName');
  });
  
  it('deve incluir stepId agendamento-laudo na condição de expansão', () => {
    const clientWorkflowPath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
    const clientWorkflowContent = readFileSync(clientWorkflowPath, 'utf-8');
    
    // Verifica se stepId está na condição de expansão
    expect(clientWorkflowContent).toContain('step.stepId === "agendamento-laudo"');
  });
});
