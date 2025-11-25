import { describe, it, expect } from 'vitest';

describe('Condições de Expansão das Etapas', () => {
  // Simula a lógica das condições de expansão
  const shouldShowExpandButton = (step: any) => {
    const totalSubTasks = step.subTasks?.length || 0;
    return (
      totalSubTasks > 0 ||
      step.stepId === "cadastro" ||
      step.stepId === "central-mensagens" ||
      step.stepId === "agendamento-psicotecnico" ||
      step.stepId === "agendamento-laudo" ||
      step.stepId === "juntada-documentos" ||
      step.stepId === "acompanhamento-sinarm"
    );
  };

  const shouldRenderCardContent = (isExpanded: boolean, step: any) => {
    const totalSubTasks = step.subTasks?.length || 0;
    return isExpanded && (
      totalSubTasks > 0 ||
      step.stepId === "cadastro" ||
      step.stepId === "central-mensagens" ||
      step.stepId === "agendamento-psicotecnico" ||
      step.stepId === "agendamento-laudo" ||
      step.stepId === "juntada-documentos" ||
      step.stepId === "acompanhamento-sinarm"
    );
  };

  describe('Botão de Expansão', () => {
    it('deve mostrar botão para etapa Cadastro', () => {
      const step = { stepId: 'cadastro', subTasks: [] };
      expect(shouldShowExpandButton(step)).toBe(true);
    });

    it('deve mostrar botão para etapa Central de Mensagens', () => {
      const step = { stepId: 'central-mensagens', subTasks: [] };
      expect(shouldShowExpandButton(step)).toBe(true);
    });

    it('deve mostrar botão para etapa Agendamento Psicotécnico', () => {
      const step = { stepId: 'agendamento-psicotecnico', subTasks: [] };
      expect(shouldShowExpandButton(step)).toBe(true);
    });

    it('deve mostrar botão para etapa Agendamento de Laudo', () => {
      const step = { stepId: 'agendamento-laudo', subTasks: [] };
      expect(shouldShowExpandButton(step)).toBe(true);
    });

    it('deve mostrar botão para etapa Juntada de Documentos', () => {
      const step = { stepId: 'juntada-documentos', subTasks: [] };
      expect(shouldShowExpandButton(step)).toBe(true);
    });

    it('deve mostrar botão para etapa Acompanhamento Sinarm', () => {
      const step = { stepId: 'acompanhamento-sinarm', subTasks: [] };
      expect(shouldShowExpandButton(step)).toBe(true);
    });

    it('deve mostrar botão para etapa com subtarefas', () => {
      const step = { stepId: 'outra-etapa', subTasks: [{ id: 1 }] };
      expect(shouldShowExpandButton(step)).toBe(true);
    });

    it('não deve mostrar botão para etapa sem stepId especial e sem subtarefas', () => {
      const step = { stepId: 'etapa-desconhecida', subTasks: [] };
      expect(shouldShowExpandButton(step)).toBe(false);
    });
  });

  describe('Renderização do CardContent', () => {
    it('deve renderizar conteúdo quando expandido - Cadastro', () => {
      const step = { stepId: 'cadastro', subTasks: [] };
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('deve renderizar conteúdo quando expandido - Central de Mensagens', () => {
      const step = { stepId: 'central-mensagens', subTasks: [] };
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('deve renderizar conteúdo quando expandido - Agendamento Psicotécnico', () => {
      const step = { stepId: 'agendamento-psicotecnico', subTasks: [] };
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('deve renderizar conteúdo quando expandido - Agendamento de Laudo', () => {
      const step = { stepId: 'agendamento-laudo', subTasks: [] };
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('deve renderizar conteúdo quando expandido - Juntada de Documentos', () => {
      const step = { stepId: 'juntada-documentos', subTasks: [] };
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('deve renderizar conteúdo quando expandido - Acompanhamento Sinarm', () => {
      const step = { stepId: 'acompanhamento-sinarm', subTasks: [] };
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('não deve renderizar quando NÃO expandido', () => {
      const step = { stepId: 'agendamento-laudo', subTasks: [] };
      expect(shouldRenderCardContent(false, step)).toBe(false);
    });

    it('deve renderizar quando expandido e tem subtarefas', () => {
      const step = { stepId: 'outra-etapa', subTasks: [{ id: 1 }] };
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('não deve renderizar quando expandido mas sem stepId especial e sem subtarefas', () => {
      const step = { stepId: 'etapa-desconhecida', subTasks: [] };
      expect(shouldRenderCardContent(true, step)).toBe(false);
    });
  });

  describe('Consistência entre Condições', () => {
    const allStepIds = [
      'cadastro',
      'central-mensagens',
      'agendamento-psicotecnico',
      'agendamento-laudo',
      'juntada-documentos',
      'acompanhamento-sinarm'
    ];

    it('todas as etapas especiais devem ter botão E renderizar conteúdo', () => {
      allStepIds.forEach(stepId => {
        const step = { stepId, subTasks: [] };
        expect(shouldShowExpandButton(step)).toBe(true);
        expect(shouldRenderCardContent(true, step)).toBe(true);
      });
    });

    it('etapas com subtarefas devem ter botão E renderizar conteúdo', () => {
      const step = { stepId: 'qualquer-etapa', subTasks: [{ id: 1 }, { id: 2 }] };
      expect(shouldShowExpandButton(step)).toBe(true);
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });
  });

  describe('Casos Específicos - Agendamento de Laudo', () => {
    it('deve permitir expansão mesmo sem subtarefas', () => {
      const step = {
        stepId: 'agendamento-laudo',
        stepTitle: 'Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)',
        subTasks: [],
        completed: false
      };
      
      expect(shouldShowExpandButton(step)).toBe(true);
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('deve permitir expansão mesmo quando marcado como concluído', () => {
      const step = {
        stepId: 'agendamento-laudo',
        stepTitle: 'Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)',
        subTasks: [],
        completed: true
      };
      
      expect(shouldShowExpandButton(step)).toBe(true);
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('deve permitir expansão com scheduledDate preenchida', () => {
      const step = {
        stepId: 'agendamento-laudo',
        stepTitle: 'Agendamento de Laudo de Capacidade Técnica para a Obtenção do Certificado de Registro (CR)',
        subTasks: [],
        completed: true,
        scheduledDate: new Date('2025-01-15T14:30:00'),
        examinerName: 'Dr. João Silva'
      };
      
      expect(shouldShowExpandButton(step)).toBe(true);
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });
  });

  describe('Casos Específicos - Agendamento Psicotécnico', () => {
    it('deve permitir expansão mesmo sem subtarefas', () => {
      const step = {
        stepId: 'agendamento-psicotecnico',
        stepTitle: 'Encaminhamento de Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo',
        subTasks: [],
        completed: false
      };
      
      expect(shouldShowExpandButton(step)).toBe(true);
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });

    it('deve permitir expansão com subtarefas', () => {
      const step = {
        stepId: 'agendamento-psicotecnico',
        stepTitle: 'Encaminhamento de Avaliação Psicológica para Concessão de Registro e Porte de Arma de Fogo',
        subTasks: [
          { id: 1, label: 'Encaminhamento', completed: false },
          { id: 2, label: 'Agendamento', completed: false }
        ],
        completed: false
      };
      
      expect(shouldShowExpandButton(step)).toBe(true);
      expect(shouldRenderCardContent(true, step)).toBe(true);
    });
  });
});
