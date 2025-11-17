import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowCard } from "@/components/WorkflowCard";
import { useClients } from "@/contexts/ClientsContext";
import { WorkflowStep } from "@/hooks/useWorkflowState";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HandshakeIcon,
  MessageSquare,
  ShieldCheck,
  Target,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

const ICONS = {
  "processo-venda": <HandshakeIcon className="h-5 w-5" />,
  "cadastro": <UserPlus className="h-5 w-5" />,
  "boas-vindas": <MessageSquare className="h-5 w-5" />,
  "agendamento-psicotecnico": <ClipboardCheck className="h-5 w-5" />,
  "juntada-documento": <FileText className="h-5 w-5" />,
  "laudo-arma": <Target className="h-5 w-5" />,
  "despachante": <ShieldCheck className="h-5 w-5" />,
  "fim": <CheckCircle2 className="h-5 w-5" />,
};

export default function ClientWorkflow() {
  const [, params] = useRoute("/client/:id");
  const [, setLocation] = useLocation();
  const { getClient, updateWorkflow } = useClients();
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([]);

  const client = params?.id ? getClient(params.id) : undefined;

  useEffect(() => {
    if (client) {
      setWorkflow(client.workflow);
    }
  }, [client]);

  useEffect(() => {
    if (client && workflow.length > 0) {
      updateWorkflow(client.id, workflow);
    }
  }, [workflow, client?.id]);

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Cliente não encontrado</p>
            <Button onClick={() => setLocation("/dashboard")}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const toggleStep = (stepId: string) => {
    setWorkflow((prev) =>
      prev.map((step) => {
        if (step.id === stepId) {
          const newCompleted = !step.completed;
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

  const completedSteps = workflow.filter((s) => s.completed).length;
  const totalSteps = workflow.length;
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-1">
                <span>📧 {client.email}</span>
                <span>📱 {client.phone}</span>
                <span>🆔 {client.cpf}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Progress Card */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Progresso do Processo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {completedSteps} de {totalSteps} etapas concluídas
                </span>
                <span className="font-bold text-primary">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Steps */}
        <div className="space-y-4">
          {workflow.map((step) => (
            <WorkflowCard
              key={step.id}
              title={step.title}
              completed={step.completed}
              subTasks={step.subTasks}
              onToggle={() => toggleStep(step.id)}
              onSubTaskToggle={(taskId) => toggleSubTask(step.id, taskId)}
              icon={ICONS[step.id as keyof typeof ICONS]}
            />
          ))}
        </div>

        {/* Completion Message */}
        {progress === 100 && (
          <Card className="mt-8 bg-primary/10 border-primary">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
                <h2 className="text-2xl font-bold text-foreground">
                  🎉 Parabéns! Processo Concluído!
                </h2>
                <p className="text-muted-foreground">
                  Todas as etapas do processo de CR de {client.name} foram finalizadas
                  com sucesso.
                </p>
                <Button onClick={() => setLocation("/dashboard")}>
                  Voltar ao Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
