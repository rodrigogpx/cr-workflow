import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentUpload } from "@/components/DocumentUpload";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Target } from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function ClientWorkflow() {
  const { id } = useParams();
  const clientId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const { data: client, isLoading: clientLoading } = trpc.clients.getById.useQuery(
    { id: clientId },
    { enabled: !!clientId }
  );

  const { data: workflow, isLoading: workflowLoading, refetch } = trpc.workflow.getByClient.useQuery(
    { clientId },
    { enabled: !!clientId }
  );

  const updateStepMutation = trpc.workflow.updateStep.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const updateSubTaskMutation = trpc.workflow.updateSubTask.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  const toggleStep = (stepId: number, currentStatus: boolean) => {
    updateStepMutation.mutate({
      clientId,
      stepId,
      completed: !currentStatus,
    });
  };

  const toggleSubTask = (subTaskId: number, currentStatus: boolean) => {
    updateSubTaskMutation.mutate({
      clientId,
      subTaskId,
      completed: !currentStatus,
    });
  };

  const toggleExpanded = (stepId: number) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  if (clientLoading || workflowLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-semibold mb-4">Cliente não encontrado</p>
            <Button onClick={() => setLocation("/dashboard")}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedSteps = workflow?.filter(s => s.completed).length || 0;
  const totalSteps = workflow?.length || 0;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
              <p className="text-sm text-muted-foreground">
                {client.cpf} • {client.email}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/trpc/documents.downloadEnxoval?input=${encodeURIComponent(JSON.stringify({ clientId }))}`, '_blank');
                  toast.success('Preparando download do enxoval...');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar Enxoval
              </Button>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{user?.role === 'admin' ? 'Admin' : 'Operador'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
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
                <span className="font-bold text-primary">{progress}%</span>
              </div>
              <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: progress + "%" }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {workflow?.map((step) => {
            const hasSubTasks = step.subTasks && step.subTasks.length > 0;
            const isExpanded = expandedSteps[step.id];

            return (
              <Card
                key={step.id}
                className={"transition-all " + (step.completed ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20" : "")}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={step.completed}
                      onCheckedChange={() => toggleStep(step.id, step.completed)}
                      className="h-6 w-6"
                    />
                    <div className="flex-1">
                      <CardTitle className={"text-lg " + (step.completed ? "line-through text-muted-foreground" : "")}>
                        {step.stepTitle}
                      </CardTitle>
                    </div>
                    {step.completed && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                    {hasSubTasks && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleExpanded(step.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {hasSubTasks && isExpanded && (
                  <CardContent>
                    <div className="space-y-3 pl-10">
                      {step.subTasks?.map((subTask) => (
                        <div key={subTask.id} className="flex items-center gap-3">
                          <Checkbox
                            checked={subTask.completed}
                            onCheckedChange={() => toggleSubTask(subTask.id, subTask.completed)}
                          />
                          <span className={"text-sm " + (subTask.completed ? "line-through text-muted-foreground" : "")}
                          >
                            {subTask.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}

                {isExpanded && (
                  <CardContent>
                    <DocumentUpload
                      clientId={clientId}
                      stepId={step.id}
                      stepTitle={step.stepTitle}
                    />
                  </CardContent>
                )}        </Card>
            );
          })}
        </div>

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
    </div>
  );
}
