import { useEffect, useState } from "react";

export interface SubTask {
  id: string;
  label: string;
  completed: boolean;
}

export interface WorkflowStep {
  id: string;
  title: string;
  completed: boolean;
  subTasks?: SubTask[];
}

const INITIAL_WORKFLOW: WorkflowStep[] = [
  {
    id: "processo-venda",
    title: "Processo de Venda",
    completed: false,
  },
  {
    id: "cadastro",
    title: "Cadastro",
    completed: false,
  },
  {
    id: "boas-vindas",
    title: "Boas Vindas",
    completed: false,
    subTasks: [
      { id: "bv-1", label: "Enviar mensagem de boas-vindas", completed: false },
      { id: "bv-2", label: "Enviar checklist de documentos", completed: false },
      { id: "bv-3", label: "Criar pasta digital do cliente", completed: false },
    ],
  },
  {
    id: "agendamento-psicotecnico",
    title: "Agendamento Psicotécnico",
    completed: false,
    subTasks: [
      { id: "ap-1", label: "Enviar encaminhamento para clínica", completed: false },
      { id: "ap-2", label: "Cliente agendar exame", completed: false },
      { id: "ap-3", label: "Confirmar realização do exame", completed: false },
      { id: "ap-4", label: "Receber laudo aprovado", completed: false },
    ],
  },
  {
    id: "juntada-documento",
    title: "Juntada de Documento",
    completed: false,
    subTasks: [
      { id: "jd-1", label: "Comprovante de residência atual", completed: false },
      { id: "jd-2", label: "Comprovantes 5 anos anteriores", completed: false },
      { id: "jd-3", label: "Certidão Justiça Federal", completed: false },
      { id: "jd-4", label: "Certidão Justiça Militar", completed: false },
      { id: "jd-5", label: "Certidão Crimes Eleitorais", completed: false },
      { id: "jd-6", label: "Certidão TJDFT", completed: false },
      { id: "jd-7", label: "Comprovante ocupação lícita", completed: false },
      { id: "jd-8", label: "Declarações assinadas", completed: false },
    ],
  },
  {
    id: "laudo-arma",
    title: "Laudo Arma de Fogo",
    completed: false,
  },
  {
    id: "despachante",
    title: "Despachante",
    completed: false,
  },
  {
    id: "fim",
    title: "Fim",
    completed: false,
  },
];

const STORAGE_KEY = "firerange-workflow-state";

export function useWorkflowState() {
  const [workflow, setWorkflow] = useState<WorkflowStep[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return INITIAL_WORKFLOW;
      }
    }
    return INITIAL_WORKFLOW;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workflow));
  }, [workflow]);

  const toggleStep = (stepId: string) => {
    setWorkflow((prev) =>
      prev.map((step) => {
        if (step.id === stepId) {
          const newCompleted = !step.completed;
          // Se marcar como completo, marcar todas as subtarefas
          if (newCompleted && step.subTasks) {
            return {
              ...step,
              completed: newCompleted,
              subTasks: step.subTasks.map((st) => ({ ...st, completed: true })),
            };
          }
          return { ...step, completed: newCompleted };
        }
        return step;
      })
    );
  };

  const toggleSubTask = (stepId: string, subTaskId: string) => {
    setWorkflow((prev) =>
      prev.map((step) => {
        if (step.id === stepId && step.subTasks) {
          const updatedSubTasks = step.subTasks.map((st) =>
            st.id === subTaskId ? { ...st, completed: !st.completed } : st
          );
          // Marcar step como completo se todas as subtarefas estiverem completas
          const allCompleted = updatedSubTasks.every((st) => st.completed);
          return {
            ...step,
            subTasks: updatedSubTasks,
            completed: allCompleted,
          };
        }
        return step;
      })
    );
  };

  const resetWorkflow = () => {
    setWorkflow(INITIAL_WORKFLOW);
    localStorage.removeItem(STORAGE_KEY);
  };

  const completedSteps = workflow.filter((s) => s.completed).length;
  const totalSteps = workflow.length;
  const progress = (completedSteps / totalSteps) * 100;

  return {
    workflow,
    toggleStep,
    toggleSubTask,
    resetWorkflow,
    progress,
    completedSteps,
    totalSteps,
  };
}
