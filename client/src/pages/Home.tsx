import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowCard } from "@/components/WorkflowCard";
import { useWorkflowState } from "@/hooks/useWorkflowState";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HandshakeIcon,
  MessageSquare,
  ShieldCheck,
  Target,
  UserPlus,
} from "lucide-react";

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

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const {
    workflow,
    toggleStep,
    toggleSubTask,
    resetWorkflow,
    progress,
    completedSteps,
    totalSteps,
  } = useWorkflowState();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Fire Range - Workflow CR
              </h1>
              <p className="text-muted-foreground mt-1">
                Sistema de acompanhamento do processo de obtenção do CR
              </p>
            </div>
            <Button
              variant="outline"
              onClick={resetWorkflow}
              className="hover:bg-destructive hover:text-destructive-foreground"
            >
              Resetar Processo
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Progress Card */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Progresso Geral</CardTitle>
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
                  Todas as etapas do processo de CR foram finalizadas com sucesso.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container py-6 text-center text-sm text-muted-foreground">
          <p>Fire Range - Tiro e Caça | Sistema de Workflow CR</p>
          <p className="mt-1">DF-150, Km 08 - Sobradinho/DF</p>
        </div>
      </footer>
    </div>
  );
}
