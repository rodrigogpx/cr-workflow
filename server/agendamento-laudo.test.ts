import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Sistema de Agendamento de Laudo', () => {
  describe('Template de Email', () => {
    it('deve ter template HTML de agendamento de laudo criado', () => {
      const templatePath = resolve(__dirname, '../email-templates/agendamento-laudo.html');
      const templateContent = readFileSync(templatePath, 'utf-8');
      
      expect(templateContent).toContain('Informações do Agendamento');
      expect(templateContent).toContain('{{data_agendamento}}');
      expect(templateContent).toContain('{{examinador}}');
      expect(templateContent).toContain('Laudo de Capacidade Técnica');
    });
  });

  describe('Componente EmailPreview', () => {
    it('deve aceitar prop requiresScheduling', () => {
      const componentPath = resolve(__dirname, '../client/src/components/EmailPreview.tsx');
      const componentContent = readFileSync(componentPath, 'utf-8');
      
      expect(componentContent).toContain('requiresScheduling');
      expect(componentContent).toContain('scheduledDate');
    });

    it('deve desabilitar botão quando requiresScheduling é true e não há scheduledDate', () => {
      const componentPath = resolve(__dirname, '../client/src/components/EmailPreview.tsx');
      const componentContent = readFileSync(componentPath, 'utf-8');
      
      expect(componentContent).toContain('requiresScheduling && !scheduledDate');
      expect(componentContent).toContain('disabled');
    });

    it('deve exibir mensagem de aviso quando falta agendamento', () => {
      const componentPath = resolve(__dirname, '../client/src/components/EmailPreview.tsx');
      const componentContent = readFileSync(componentPath, 'utf-8');
      
      expect(componentContent).toContain('É necessário agendar uma data antes de enviar este email');
    });
  });

  describe('Página ClientWorkflow', () => {
    it('deve renderizar botão de email na etapa de Exame de Capacidade Técnica', () => {
      const pagePath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
      const pageContent = readFileSync(pagePath, 'utf-8');
      
      expect(pageContent).toContain('Exame de Capacidade Técnica');
      expect(pageContent).toContain('agendamento_laudo');
      expect(pageContent).toContain('EmailPreview');
    });

    it('deve passar scheduledDate para EmailPreview', () => {
      const pagePath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
      const pageContent = readFileSync(pagePath, 'utf-8');
      
      expect(pageContent).toContain('scheduledDate={step.scheduledDate}');
      expect(pageContent).toContain('requiresScheduling={true}');
    });

    it('deve permitir expansão da etapa de Exame de Capacidade Técnica', () => {
      const pagePath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
      const pageContent = readFileSync(pagePath, 'utf-8');
      
      // Verifica se a etapa está na condição de expansão
      expect(pageContent).toMatch(/stepTitle === "Exame de Capacidade Técnica".*&&/);
    });
  });

  describe('Schema do Banco de Dados', () => {
    it('deve ter campos scheduledDate e examinerName na tabela workflowSteps', () => {
      const schemaPath = resolve(__dirname, '../drizzle/schema.ts');
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      
      expect(schemaContent).toContain('scheduledDate');
      expect(schemaContent).toContain('examinerName');
      expect(schemaContent).toContain('timestamp("scheduledDate")');
      expect(schemaContent).toContain('varchar("examinerName"');
    });
  });

  describe('Integração Completa', () => {
    it('deve ter todos os componentes necessários para o fluxo de agendamento', () => {
      // 1. Template de email existe
      const templatePath = resolve(__dirname, '../email-templates/agendamento-laudo.html');
      expect(() => readFileSync(templatePath, 'utf-8')).not.toThrow();

      // 2. Componente EmailPreview suporta validação
      const componentPath = resolve(__dirname, '../client/src/components/EmailPreview.tsx');
      const componentContent = readFileSync(componentPath, 'utf-8');
      expect(componentContent).toContain('requiresScheduling');

      // 3. Página ClientWorkflow usa o componente corretamente
      const pagePath = resolve(__dirname, '../client/src/pages/ClientWorkflow.tsx');
      const pageContent = readFileSync(pagePath, 'utf-8');
      expect(pageContent).toContain('agendamento_laudo');

      // 4. Schema do banco tem os campos necessários
      const schemaPath = resolve(__dirname, '../drizzle/schema.ts');
      const schemaContent = readFileSync(schemaPath, 'utf-8');
      expect(schemaContent).toContain('scheduledDate');
    });
  });
});
